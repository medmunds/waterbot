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
import {selectRecentData, selectLastUpdate} from '../store/data';
import Section from "../components/Section";


function selectRecentRange(state) {
  const {ui: {day: {endTimestamp}}} = state;
  const end = moment(endTimestamp).endOf('hour');
  return moment.duration(24, 'hours').beforeMoment(end);
}

function selectLastReading(state) {
  const recent = selectRecentData(state);  // not necessarily sorted
  return maxBy(recent, 'timestamp');
}

//
// CurrentMeter
//

function selectCurrentMeter(state) {
  const lastReading = selectLastReading(state) || {};
  const {current_reading_cuft, timestamp} = lastReading;

  return {
    value: current_reading_cuft,
    fractionDigits: 1,
    suffix: " cu ft",
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

function makeRecentSparklineSelector(valueKey, props) {
  const {scorecard, sparkline} = props;

  return function select(state) {
    const recent = selectRecentData(state);
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
// CurrentBattery
//

const selectCurrentBattery = makeRecentSparklineSelector('battery_pct', {
  scorecard: {
    title: "Battery charge",
    fractionDigits: 1,
    suffix: "%",
  },
  sparkline: {
    yDomain: [0, 100],
  },
});

export const CurrentBattery = connect(selectCurrentBattery)(ScorecardAndSparkline);


//
// CurrentWiFi
//

const selectCurrentWiFi = makeRecentSparklineSelector('wifi_signal', {
  scorecard: {
    title: "WiFi signal",
    fractionDigits: 0,
  },
  sparkline: {
    yDomain: [-127, -1],
  },
});

export const CurrentWiFi = connect(selectCurrentWiFi)(ScorecardAndSparkline);


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
  const data = selectRecentData(state, range)
    // FUTURE: .filter(row => row.period_sec > 0)
    .map(row => ({
      x: row.timestamp,
      y: row.usageGals,
      // FUTURE: use histogram range instead...
      // x0: moment(row.timestamp).subtract(row.period_sec, 'seconds'),
      // y: 60 * row.usageGals / row.period_sec, // gallons per minute
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
      // FUTURE: {label: "GPM", valueKey: "y", type: "bar"},
    ],
  };
}

export const RecentChart = connect(selectRecentChart)(Chart);


//
// RecentScorecard
//

function selectRecentScorecard(state) {
  const range = selectRecentRange(state);
  const totalUsageGals = sumBy(selectRecentData(state, range), 'usageGals');
  const valid = selectLastUpdate(state, 'recent') !== undefined;

  return {
    title: "Last 24 hours",
    value: valid ? totalUsageGals : undefined,
    fractionDigits: 1,
    suffix: " gallons",
  };
}

export const RecentScorecard = connect(selectRecentScorecard)(Scorecard);


//
// RecentActivity view
//

export default function RecentActivity() {
  return (
    <Section
      title="Recent activity"
      chart={<RecentChart/>}
    >
      <RecentScorecard/>
      <CurrentMeter/>
      <CurrentBattery/>
      <CurrentWiFi/>
    </Section>
  );
}
