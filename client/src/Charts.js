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
  // m is 1-based month
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
  const data = [];

  // VictoryGroup has trouble with domainPadding when x is 0-based, so just stick with 1-based months

  const thisYearStart = year ? moment({year}) : moment().startOf('year');
  const thisYearEnd = thisYearStart.clone().endOf('year');
  Object.values(monthly)
    .filter(row => (thisYearStart <= row.timestamp && row.timestamp <= thisYearEnd))
    .forEach(row => {
      const month = parseInt(row.timestampStr.slice(5), 10); // 1-based
      const index = month - 1;
      data[index] = data[index] || {x: month};
      data[index].thisYear = row.usageGals;
    });

  const lastYearStart = thisYearStart.clone().subtract(1, 'year');
  const lastYearEnd = thisYearEnd.clone().subtract(1, 'year');
  Object.values(monthly)
    .filter(row => (lastYearStart <= row.timestamp && row.timestamp <= lastYearEnd))
    .forEach(row => {
      const month = parseInt(row.timestampStr.slice(5), 10); // 1-based
      const index = month - 1;
      data[index] = data[index] || {x: month};
      data[index].lastYear = row.usageGals;
    });

  const averageYears = 3;
  const averageStart = thisYearStart.clone().subtract(averageYears, 'year');
  const averageEnd = lastYearEnd.clone();
  Object.values(monthly)
    .filter(row => (averageStart <= row.timestamp && row.timestamp <= averageEnd))
    .forEach(row => {
      const month = parseInt(row.timestampStr.slice(5), 10); // 1-based
      const index = month - 1;
      data[index] = data[index] || {x: month};
      data[index].averageTotal = (data[index].averageTotal || 0) + row.usageGals;
      data[index].averageN = (data[index].averageN || 0) + 1;
    });
  data.forEach(row => {
    if (row.averageN && row.averageTotal !== undefined) {
      row.average = row.averageTotal / row.averageN;
    }
  });

  return {
    data,
    xTickFormat: formatMonth,
    theme,
    start: 1,
    end: 12,
    series: [
      {label: thisYearStart.format('YYYY'), valueKey: "thisYear", type: "bar"},
      {label: lastYearStart.format('YYYY'), valueKey: "lastYear", type: "bar"},
      // {label: `${averageYears}-year average`, valueKey: "average", type: "step"},
      {label: `Avg ${averageStart.format('YYYY')}–${averageEnd.format('YY')}`, valueKey: "average", type: "step"},
    ],
  };
}

export const ChartThisYear = connect(mapStateToPropsYTD)(ComparisonChart);
