// Recent meter activity and current status

import last from 'lodash/last';
import maxBy from 'lodash/maxBy';
import sumBy from 'lodash/sumBy';
import moment from 'moment';
import 'twix'; // extends moment
import React from 'react';
import {connect} from 'react-redux';

import Chart from '../components/Chart';
import Scorecard from '../components/Scorecard';
import Sparkline from '../components/Sparkline';
import {selectMinutelyData, selectDeviceData, selectLastUpdate} from '../store/data';
import Section from "../components/Section";


function selectRecentRange(state) {
  const {ui: {day: {endTimestamp}}} = state;
  const end = moment(endTimestamp).endOf('hour');
  return moment.duration(24, 'hours').beforeMoment(end);
}

function selectLastReading(state) {
  const recent = selectDeviceData(state);  // not necessarily sorted
  return maxBy(recent, 'timestamp');
}

//
// CurrentMeter
//

function selectCurrentMeter(state) {
  const lastReading = selectLastReading(state) || {};
  const {meter_reading, timestamp} = lastReading;

  return {
    value: meter_reading,
    fractionDigits: 0,
    lastReadingTime: timestamp,
  };
}

function CurrentMeterComponent({lastReadingTime, ...scorecardProps}) {
  return (
    <Scorecard title="Current reading" {...scorecardProps}>
      {lastReadingTime ? lastReadingTime.format('lll') : "(loading)"}
    </Scorecard>
  );
}

export const CurrentMeter = connect(selectCurrentMeter)(CurrentMeterComponent);


//
// SparklineAndScorecard
//

function makeDeviceSparklineSelector(valueKey, props) {
  const {scorecard, sparkline} = props;

  return function select(state) {
    const recent = selectDeviceData(state);
    const data = recent
      .sort((a, b) => (a.timestamp - b.timestamp))
      .map(row => ({x: row.timestamp, y: row[valueKey]}))
      .filter(({y}) => y !== undefined && y !== null);
    const lastReading = last(data);
    const value = lastReading ? lastReading.y : undefined;

    return {
      scorecard: {
        ...scorecard,
        value,
      },
      sparkline: {
        ...sparkline,
        data,
      }
    };
  }
}

function ScorecardAndSparkline({scorecard, sparkline}) {
  return (
    <Scorecard {...scorecard}>
      <Sparkline {...sparkline}/>
    </Scorecard>
  );
}


//
// Device Battery
//

const selectCurrentBatteryCharge = makeDeviceSparklineSelector('battery_pct', {
  scorecard: {
    title: "Battery charge",
    fractionDigits: 1,
    suffix: "%",
  },
  sparkline: {
    yDomain: [0, 100],
  },
});

export const BatteryCharge = connect(selectCurrentBatteryCharge)(ScorecardAndSparkline);

const selectCurrentBatteryVoltage = makeDeviceSparklineSelector('battery_v', {
  scorecard: {
    title: "Battery power",
    fractionDigits: 1,
    suffix: " volts",
  },
  sparkline: {
    yDomain: [0, 4.2],
  },
});

export const BatteryVoltage = connect(selectCurrentBatteryVoltage)(ScorecardAndSparkline);


//
// Device Wi-Fi
//

const selectCurrentWiFiStrength = makeDeviceSparklineSelector('wifi_strength_pct', {
  scorecard: {
    title: "WiFi strength",
    fractionDigits: 1,
    suffix: "%",
  },
  sparkline: {
    yDomain: [0, 100],
  },
});

export const WiFiStrength = connect(selectCurrentWiFiStrength)(ScorecardAndSparkline);

const selectCurrentWiFiQuality = makeDeviceSparklineSelector('wifi_quality_pct', {
  scorecard: {
    title: "WiFi quality",
    fractionDigits: 1,
    suffix: "%",
  },
  sparkline: {
    yDomain: [0, 100],
  },
});

export const WiFiQuality = connect(selectCurrentWiFiQuality)(ScorecardAndSparkline);


//
// Device Connectivity
//

const selectCurrentPublishDelay = makeDeviceSparklineSelector('publish_sec', {
  scorecard: {
    title: "Publish delay",
    fractionDigits: 0,
    suffix: " seconds",
  },
  sparkline: {
    yDomain: [0, 20],
  },
});

export const PublishDelay = connect(selectCurrentPublishDelay)(ScorecardAndSparkline);

const selectCurrentDeliveryDelay = makeDeviceSparklineSelector('delivery_sec', {
  scorecard: {
    title: "Delivery delay",
    fractionDigits: 0,
    suffix: " seconds",
  },
  sparkline: {
    yDomain: [0, 20],
  },
});

export const DeliveryDelay = connect(selectCurrentDeliveryDelay)(ScorecardAndSparkline);


//
// RecentChart
//

function formatHour(ts, i) {
  // ts is a Date or int timestamp
  const t = moment(ts);
  const hourString = t.format('ha');
  if (i === 0 || t.hour() === 0) {
    return (
      <tspan>
        <tspan x="0" y="0">{hourString}</tspan>
        <tspan x="0" dy="1.2em">{t.format('ddd M/D')}</tspan>
      </tspan>
    );
  } else {
    return hourString;
  }
}

function formatTimestamp(ts) {
  const t = moment(ts);
  return t.format('llll');
}


function selectRecentChart(state) {
  const range = selectRecentRange(state);
  const data = selectMinutelyData(state, range)
    .map(row => ({
      x: row.timestamp,
      y: row.usageGals,
    }));

  const xDomain = [range.start(), range.end()];
  const xMinorTickValues = range.toArray('hours');
  const xMajorTickValues = xMinorTickValues.filter(d => d.hour() % 3 === 0);
  const xGridValues = xMajorTickValues.filter(d => d.hour() === 0);

  return {
    data,
    xDomain,
    xTickFormat: formatHour,
    xMinorTickValues,
    xMajorTickValues,
    xGridValues,
    xType: "time",
    xTooltipFormat: formatTimestamp,
    // FUTURE: yTickFormat: formatNumber1Digit,
    series: [
      {label: "gallons", valueKey: "y", type: "bar"},
    ],
  };
}

export const RecentChart = connect(selectRecentChart)(Chart);


//
// RecentScorecard
//

function selectRecentScorecard(state) {
  const range = selectRecentRange(state);
  const totalUsageGals = sumBy(selectMinutelyData(state, range), 'usageGals');
  const valid = selectLastUpdate(state, 'minutely') !== undefined;

  return {
    title: "Last 24 hours",
    value: valid ? totalUsageGals : undefined,
    fractionDigits: 0,
    suffix: " gallons",
  };
}

export const RecentScorecard = connect(selectRecentScorecard)(Scorecard);


//
// RecentActivity view
//

export function RecentActivity() {
  return (
    <Section
      title="Recent activity"
      chart={<RecentChart/>}
    >
      <RecentScorecard/>
      <CurrentMeter/>
    </Section>
  );
}

export function DeviceStatus() {
  return (
    <Section
      title="Waterbot status"
    >
      <BatteryCharge/>
      <BatteryVoltage/>
      <WiFiStrength/>
      <WiFiQuality/>
      <PublishDelay/>
      <DeliveryDelay/>
    </Section>
  )
}
