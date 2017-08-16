import moment from 'moment';
import React from 'react';
import {connect} from 'react-redux';

import Chart from "./components/Chart";


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

function formatFullHour(ts) {
  const t = moment(ts);
  return t.format('ddd M/D ha');
}

function formatDay(ts) {
  // ts is a Date or int timestamp
  const t = moment(ts);
  const format = t.date() === 1 ? 'MMM D' : 'D';
  return t.format(format);
}

function formatFullDay(ts) {
  const t = moment(ts);
  return t.format('dddd, MMMM D');
}

function formatMonth(m) {
  // m is 0-based month
  return moment({month: m}).format('MMM');
}

function formatFullMonth(m) {
  // m is 0-based month
  return moment({month: m}).format('MMMM');
}


function mapStateToPropsDay(state) {
  const {data: {hourly}, ui: {day: {endTimestamp}}} = state;
  const end = moment(endTimestamp).endOf('hour');
  const start = end.clone().startOf('hour').subtract(24, 'hours');
  const data = Object.values(hourly)
    .filter(row => (start <= row.timestamp && row.timestamp <= end))
    .map(row => ({x: row.timestamp, y: row.usageGals}));

  return {
    data,
    xTickFormat: formatHour,
    xType: "time",
    xTooltipFormat: formatFullHour,
    series: [
      {label: "gallons", valueKey: "y", type: "bar", color: "#4285F5"},
    ],
  };
}

export const ChartLast24Hours = connect(mapStateToPropsDay)(Chart);


function mapStateToPropsMonth(state) {
  const {data: {daily}, ui: {month: {endTimestamp}}} = state;
  const end = moment(endTimestamp).endOf('day');
  const start = end.clone().startOf('day').subtract(30, 'days');
  const data = Object.values(daily)
    .filter(row => (start <= row.timestamp && row.timestamp <= end))
    .map(row => ({x: row.timestamp, y: row.usageGals}));

  return {
    data,
    xTickFormat: formatDay,
    xTooltipFormat: formatFullDay,
    xType: "time",
    series: [
      {label: "gallons", valueKey: "y", type: "bar", color: "#4285F5"},
    ],
  };
}

export const ChartLast30Days = connect(mapStateToPropsMonth)(Chart);


function mapStateToPropsYTD(state) {
  const {data: {monthly}, ui: {ytd: {year}}} = state;
  const data = [];

  const thisYearStart = year ? moment({year}) : moment().startOf('year');
  const thisYearEnd = thisYearStart.clone().endOf('year');
  Object.values(monthly)
    .filter(row => (thisYearStart <= row.timestamp && row.timestamp <= thisYearEnd))
    .forEach(row => {
      const month = parseInt(row.timestampStr.slice(5), 10) - 1; // 0-based
      data[month] = data[month] || {x: month};
      data[month].thisYear = row.usageGals;
    });

  const lastYearStart = thisYearStart.clone().subtract(1, 'year');
  const lastYearEnd = thisYearEnd.clone().subtract(1, 'year');
  Object.values(monthly)
    .filter(row => (lastYearStart <= row.timestamp && row.timestamp <= lastYearEnd))
    .forEach(row => {
      const month = parseInt(row.timestampStr.slice(5), 10) - 1; // 0-based
      data[month] = data[month] || {x: month};
      data[month].lastYear = row.usageGals;
    });

  const averageYears = 3;
  const averageStart = thisYearStart.clone().subtract(averageYears, 'year');
  const averageEnd = lastYearEnd.clone();
  Object.values(monthly)
    .filter(row => (averageStart <= row.timestamp && row.timestamp <= averageEnd))
    .forEach(row => {
      const month = parseInt(row.timestampStr.slice(5), 10) - 1; // 0-based
      data[month] = data[month] || {x: month};
      data[month].averageTotal = (data[month].averageTotal || 0) + row.usageGals;
      data[month].averageN = (data[month].averageN || 0) + 1;
    });
  data.forEach(row => {
    if (row.averageN && row.averageTotal !== undefined) {
      row.average = row.averageTotal / row.averageN;
    }
  });

  if (data.length > 0) {
    const now = moment();  // should come from state
    const month = now.month(); // 0-based
    const fraction = now.date() / now.daysInMonth();
    if (fraction > 0.1) {
      data[month].thisYearProjected = data[month].thisYear / fraction;
    }
  }

  return {
    data,
    xTickFormat: formatMonth,
    xTooltipFormat: formatFullMonth,
    series: [
      {label: lastYearStart.format('YYYY'),
        tooltipLabel: `${lastYearStart.format('YYYY')} actual`,
        valueKey: "lastYear", type: "bar",
        cluster: "lastYear", color: "#BBDEFB"},
      {label: "(projected)",
        tooltipLabel: `${thisYearStart.format('YYYY')} projected`,
        hideLegend: true,
        valueKey: "thisYearProjected", type: "bar",
        cluster: "thisYear", color: "#4285F5", fill: "transparent"},
      {label: thisYearStart.format('YYYY'),
        tooltipLabel: `${thisYearStart.format('YYYY')} actual`,
        valueKey: "thisYear", type: "bar", cluster: "thisYear", color: "#4285F5"},
      {label: `Avg ${averageStart.format('YYYY')}–${averageEnd.format('YY')}`,
        tooltipLabel: `${averageYears}-year average`,
        valueKey: "average", type: "hash",
        color: "#1565C0", stroke: "none"},
    ],
  };
}

export const ChartThisYear = connect(mapStateToPropsYTD)(Chart);
