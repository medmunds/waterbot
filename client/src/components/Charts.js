import moment from 'moment';
import React from 'react';
import TimeSeriesChart from './TimeSeriesChart';



const GALLONS_PER_CUFT = 7.48052;

function usageGallons(d) {
  return d.usage_cuft * GALLONS_PER_CUFT;
}

function formatHour(ts) {
  // Victory has flattened the moment object to an int
  const t = moment(ts);
  const hourString = t.format('ha');
  return t.hour() !== 0 ? hourString : [hourString, t.format('ddd M/D')];
}

function formatDay(ts) {
  // Victory has flattened the moment object to an int
  const t = moment(ts);
  const format = 'MMM D'; // t.day() === 1 ? 'MMM D' : 'D';
  return t.format(format);
}

function formatMonth(ts) {
  // Victory has flattened the moment object to an int
  const t = moment(ts);
  const monthString = t.format('MMM');
  return t.month() !== 0 ? monthString : [monthString, t.format('YYYY')];
}


export function HourlyChart({hourlyData, now, theme}) {
  const end = moment(now).endOf('hour');
  const start = end.clone().subtract(48, 'hours');

  return <TimeSeriesChart
    data={hourlyData}
    timeField="hour" timeFormat="YYYY-MM-DD HH" timeTickFormat={formatHour}
    start={start} end={end}
    valueField={usageGallons}
    theme={theme}
  />;
}

export function DailyChart({dailyData, now, theme}) {
  const end = moment(now).endOf('day');
  const start = end.clone().subtract(31, 'days');

  return <TimeSeriesChart
    data={dailyData}
    timeField="date" timeFormat="YYYY-MM-DD" timeTickFormat={formatDay}
    start={start} end={end}
    valueField={usageGallons}
    theme={theme}
  />;
}

export function MonthlyChart({monthlyData, now, theme}) {
  const end = moment(now).endOf('year');
  const start = end.clone().startOf('year');

  return <TimeSeriesChart
    data={monthlyData}
    timeField="month" timeFormat="YYYY-MM" timeTickFormat={formatMonth}
    start={start} end={end}
    valueField={usageGallons}
    theme={theme}
  />;
}
