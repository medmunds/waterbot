import React from 'react';
import {connect} from 'react-redux';
import last from 'lodash/last';
import Scorecard from "./components/Scorecard";
import Sparkline from "./components/Sparkline";


function selectLastReading(state) {
  const {data: {recent}} = state;
  return last(recent);
}

function selectCurrentMeter(state) {
  const lastReading = selectLastReading(state);
  if (!lastReading) {
    return {value: undefined, lastReadingTime: undefined};
  }

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
      {lastReadingTime ? lastReadingTime.format('lll') : "loading"}
    </Scorecard>
  );
}

export const CurrentMeter = connect(selectCurrentMeter)(CurrentMeterComponent);


function makeHourlySparklineSelector(valueKey, props) {
  const {scorecard, sparkline} = props;

  return function select(state) {
    const {data: {recent}} = state;
    const data = recent
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


const selectCurrentBattery = makeHourlySparklineSelector('battery_pct', {
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


const selectCurrentWiFi = makeHourlySparklineSelector('wifi_signal', {
  scorecard: {
    title: "WiFi signal",
    fractionDigits: 0,
  },
  sparkline: {
    yDomain: [-127, -1],
  },
});

export const CurrentWiFi = connect(selectCurrentWiFi)(ScorecardAndSparkline);
