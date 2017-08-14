import moment from 'moment';
import React from 'react';
import {connect} from 'react-redux';
import last from 'lodash/last';
import max from 'lodash/max';
import Scorecard from "./components/Scorecard";
import Sparkline from "./components/Sparkline";


function selectLastReading(state) {
  const {data: {hourly}} = state;
  const lastHourStr = max(Object.keys(hourly));
  return lastHourStr ? hourly[lastHourStr] : undefined;
}

function selectCurrentMeter(state) {
  const lastReading = selectLastReading(state);
  if (!lastReading) {
    return {value: undefined, lastReadingTime: undefined};
  }

  const {last_reading_cuft, last_reading_timestamp: {value: lastReadingTimeStr}} = lastReading;
  const lastReadingTime = moment.utc(lastReadingTimeStr, 'YYYY-MM-DD HH:mm:ss.SSS').local();

  return {
    value: last_reading_cuft,
    fractionDigits: 1,
    suffix: " cu ft",
    lastReadingTime,
  };
}

function CurrentMeterComponent({lastReadingTime, ...scorecardProps}) {
  return (
    <Scorecard title="Current reading" {...scorecardProps}>
      {lastReadingTime ? lastReadingTime.format('lll') : "loading"}
    </Scorecard>
  );
}

export const CurrentMeter = connect(selectCurrentMeter)(CurrentMeterComponent);


function makeHourlySparklineSelector(valueKey, props) {
  const {scorecard, sparkline} = props;

  return function select(state) {
    const {data: {hourly}} = state;
    const data = Object.keys(hourly)
      .sort()
      .map(key => ({x: hourly[key].timestamp, y: hourly[key][valueKey]}))
      .filter(({y}) => y !== undefined); //  && y !== null
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


const selectCurrentBattery = makeHourlySparklineSelector('min_battery_pct', {
  scorecard: {
    title: "Battery charge",
    fractionDigits: 1,
    suffix: "%",
  },
  sparkline: {
    domain: {y: [0, 100]},
  },
});

export const CurrentBattery = connect(selectCurrentBattery)(ScorecardAndSparkline);


const selectCurrentWiFi = makeHourlySparklineSelector('avg_wifi_signal', {
  scorecard: {
    title: "WiFi signal",
    fractionDigits: 0,
  },
  sparkline: {
    domain: {y: [-127, -1]},
  },
});

export const CurrentWiFi = connect(selectCurrentWiFi)(ScorecardAndSparkline);
