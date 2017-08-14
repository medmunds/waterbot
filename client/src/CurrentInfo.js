import moment from 'moment';
import React from 'react';
import {connect} from 'react-redux';
import max from 'lodash/max';
import Scorecard from "./components/Scorecard";


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


function selectCurrentBattery(state) {
  const lastReading = selectLastReading(state);
  if (!lastReading) {
    return {value: undefined};
  }
  const {min_battery_pct} = lastReading;

  return {
    title: "Battery charge",
    value: min_battery_pct,
    fractionDigits: 1,
    suffix: "%",
  };
}

export const CurrentBattery = connect(selectCurrentBattery)(Scorecard);


function selectCurrentWiFi(state) {
  const lastReading = selectLastReading(state);
  if (!lastReading) {
    return {value: undefined};
  }
  const {avg_wifi_signal} = lastReading;

  return {
    title: "WiFi signal",
    value: avg_wifi_signal,
    fractionDigits: 0,
  };
}

export const CurrentWiFi = connect(selectCurrentWiFi)(Scorecard);
