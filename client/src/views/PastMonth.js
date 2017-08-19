// Daily 30-day view

import moment from 'moment';
import 'twix'; // extends moment
import sumBy from 'lodash/sumBy';
import React from 'react';
import {connect} from 'react-redux';

import Chart from '../components/Chart';
import Scorecard from '../components/Scorecard';
import Section from '../components/Section';
import {selectDailyData} from '../store/data';
import {offsetRange} from '../utils/date';


function formatDay(ts) {
  // ts is a Date or int timestamp
  const t = moment(ts);
  return t.format('MMM D');
}

function formatFullDay(ts) {
  const t = moment(ts);
  return t.format('dddd, MMMM D');
}


function select30DayRange(endTimestamp) {
  return moment.duration(30, 'days').beforeMoment(endTimestamp, {allDay: true});
}

function selectThisYearRange(state) {
  const {ui: {month: {endTimestamp}}} = state;
  return select30DayRange(endTimestamp);
}


//
// PastMonthScorecard
//

export function selectPastMonthScorecard(state) {
  const thisYearRange = selectThisYearRange(state);
  const thisYearData = selectDailyData(state, thisYearRange);
  const thisYearUsage = sumBy(thisYearData, 'usageGals');

  const lastYearRange = offsetRange(thisYearRange, -1, 'year');
  const lastYearData = selectDailyData(state, lastYearRange);
  const lastYearUsage = sumBy(lastYearData, 'usageGals');

  return {
    value: thisYearUsage,
    suffix: " gallons",
    comparisonValue: lastYearUsage,
    comparisonLabel: `vs. last year (${thisYearRange.start().format('M/D')}–${thisYearRange.end().format('M/D')})`,
    decreaseIsPositive: true,
  };
}

export const PastMonthScorecard = connect(selectPastMonthScorecard)(Scorecard);


//
// PastMonthChart
//

export function selectPastMonthChart(state) {
  const thisYearRange = selectThisYearRange(state);
  const thisYearData = selectDailyData(state, thisYearRange);

  const data = thisYearData.map(row => ({x: row.timestamp, y: row.usageGals}));
  const xDomain = [thisYearRange.start(), thisYearRange.end()];
  const xMinorTickValues = thisYearRange.toArray('days').filter(d => d.day() === 0); // sundays
  const xGridValues = thisYearRange.toArray('months').map(d => d.subtract(11, 'hours')); // put grid between days

  return {
    data,
    xDomain,
    xTickFormat: formatDay,
    xMinorTickValues,
    xGridValues,
    xTooltipFormat: formatFullDay,
    xType: "time",
    series: [
      {label: "gallons", valueKey: "y", type: "bar"},
    ],
  };
}
export const PastMonthChart = connect(selectPastMonthChart)(Chart);


//
// PastMonth view
//

export default function PastMonth() {
  // FUTURE: if zoom/brush chart, title should be based on selectThisYearRange
  return (
    <Section
      title="Last 30 days"
      chart={<PastMonthChart/>}
    >
      <PastMonthScorecard/>
    </Section>
  );
}
