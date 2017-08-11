import moment from 'moment';
// import React from 'react';
import {connect} from 'react-redux';

import ComparisonChart from "./components/ComparisonChart";
import TimeSeriesChart from './components/TimeSeriesChart';
import theme from './components/victoryTheme';


function formatHour(ts, i) {
  // Victory has flattened the moment object to an int
  const t = moment(ts);
  const hourString = t.format('ha');
  if (i === 0 || t.hour() === 0) {
    return [hourString, t.format('ddd M/D')];
  } else {
    return hourString;
  }
}

function formatDay(ts) {
  // Victory has flattened the moment object to an int
  const t = moment(ts);
  const format = 'MMM D'; // t.day() === 1 ? 'MMM D' : 'D';
  return t.format(format);
}

function formatMonth(m) {
  return moment().month(m-1).format('MMM');
}


function mapStateToPropsDay(state) {
  const {data: {hourly}, ui: {day: {endTimestamp}}} = state;
  const end = moment(endTimestamp).endOf('hour');
  const start = end.clone().startOf('hour').subtract(24, 'hours');
  const data = Object.values(hourly)
    .filter(row => (start <= row.timestamp && row.timestamp <= end))
    .map(row => ({x: row.timestamp, y: row.usageGals}));

  return {
    timeTickFormat: formatHour,
    theme,
    start,
    end,
    data,
  };
}

export const ChartLast24Hours = connect(mapStateToPropsDay)(TimeSeriesChart);


function mapStateToPropsMonth(state) {
  const {data: {daily}, ui: {month: {endTimestamp}}} = state;
  const end = moment(endTimestamp).endOf('day');
  const start = end.clone().startOf('day').subtract(30, 'days');
  const data = Object.values(daily)
    .filter(row => (start <= row.timestamp && row.timestamp <= end))
    .map(row => ({x: row.timestamp, y: row.usageGals}));

  return {
    timeTickFormat: formatDay,
    theme,
    start,
    end,
    data,
  };
}

export const ChartLast30Days = connect(mapStateToPropsMonth)(TimeSeriesChart);


function mapStateToPropsYTD(state) {
  const {data: {monthly}, ui: {ytd: {year}}} = state;

  const thisYearStart = year ? moment({year}) : moment().startOf('year');
  const thisYearEnd = thisYearStart.clone().endOf('year');
  const thisYearData = Object.values(monthly)
    .filter(row => (thisYearStart <= row.timestamp && row.timestamp <= thisYearEnd))
    .map(row => ({x: parseInt(row.timestampStr.slice(5), 10), y: row.usageGals}));

  const lastYearStart = thisYearStart.clone().subtract(1, 'year');
  const lastYearEnd = thisYearEnd.clone().subtract(1, 'year');
  const lastYearData = Object.values(monthly)
    .filter(row => (lastYearStart <= row.timestamp && row.timestamp <= lastYearEnd))
    .map(row => ({x: parseInt(row.timestampStr.slice(5), 10), y: row.usageGals}));

  return {
    xTickFormat: formatMonth,
    theme,
    start: 1,
    end: 12,
    series: [
      {label: thisYearStart.format('YYYY'), data: thisYearData},
      {label: lastYearStart.format('YYYY'), data: lastYearData},
    ],
  };
}

export const ChartThisYear = connect(mapStateToPropsYTD)(ComparisonChart);
