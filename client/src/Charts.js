import moment from 'moment';
import React from 'react';
import TimeSeriesChart from './components/TimeSeriesChart';
import theme from './components/victoryTheme';
import {selectLast24HoursChart, selectLast30DaysChart, selectThisYearChart} from "./data";
import ComparisonChart from "./components/ComparisonChart";


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

function formatMonth(m) {
  return moment().month(m).format('MMM');
}


export function ChartLast24Hours({state}) {
  return <TimeSeriesChart
    timeTickFormat={formatHour}
    theme={theme}
    {...selectLast24HoursChart(state)}
  />;
}

export function ChartLast30Days({state}) {
  return <TimeSeriesChart
    timeTickFormat={formatDay}
    theme={theme}
    {...selectLast30DaysChart(state)}
  />;
}

export function ChartThisYear({state}) {
  return <ComparisonChart
    xTickFormat={formatMonth}
    theme={theme}
    {...selectThisYearChart(state)}
  />;
}
