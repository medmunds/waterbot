// Monthly comparison of current and previous year

import moment from 'moment';
import 'twix'; // extends moment
import sumBy from 'lodash/sumBy';
import React from 'react';
import {connect} from 'react-redux';

import Chart from '../components/Chart';
import Scorecard from '../components/Scorecard';
import Section from '../components/Section';
import {selectDailyData, selectMonthlyData} from '../store/data';
import {chartColors} from '../theme';
import {offsetRange} from '../utils/date';


function selectThisYearRange(state) {
  // through end of the year
  const {ui: {ytd: {year}}} = state;
  const start = year ? moment({year}) : moment().startOf('year');
  const end = start.clone().endOf('year');
  return start.twix(end, {allDay: true});
}

function selectThisYTDRange(state) {
  // through current date (if in current year)
  let range = selectThisYearRange(state);
  const now = moment();  // should come from state?
  if (range.start().year() === now.year()) {
    range = range.start().twix(now.endOf('day'), {allDay: true});
  }

  return range;
}


//
// PastYearScorecard
//

function selectPastYearScorecard(state) {
  const thisYTDRange = selectThisYTDRange(state);
  const lastYTDRange = offsetRange(thisYTDRange, -1, 'year');

  const thisYearUsage = sumBy(selectDailyData(state, thisYTDRange), 'usageGals');
  const lastYearUsage = sumBy(selectDailyData(state, lastYTDRange), 'usageGals');
  const ytdRangeLabel = `${thisYTDRange.start().format('M/D')}–${thisYTDRange.end().format('M/D')}`;

  return {
    value: thisYearUsage,
    suffix: " gallons",
    comparisonValue: lastYearUsage,
    comparisonLabel: `vs. last year (${ytdRangeLabel})`,
    decreaseIsPositive: true,
  };
}

const PastYearScorecard = connect(selectPastYearScorecard)(Scorecard);



//
// PastYearChart
//

function formatMonth(m) {
  // m is 0-based month
  return moment({month: m}).format('MMM');
}

function formatFullMonth(m) {
  // m is 0-based month
  return moment({month: m}).format('MMMM');
}


function selectPastYearChart(state) {
  const thisYearRange = selectThisYearRange(state);
  const lastYearRange = offsetRange(thisYearRange, -1, 'year');
  const averageYears = 3;
  const averageRange = moment.duration(averageYears, 'years').beforeMoment(lastYearRange.end());

  const data = [];
  selectMonthlyData(state, thisYearRange)
    .forEach(row => {
      const month = row.timestamp.month();
      data[month] = data[month] || {x: month};
      data[month].thisYear = row.usageGals;
    });
  selectMonthlyData(state, lastYearRange)
    .forEach(row => {
      const month = row.timestamp.month();
      data[month] = data[month] || {x: month};
      data[month].lastYear = row.usageGals;
    });

  selectMonthlyData(state, averageRange)
    .forEach(row => {
      const month = row.timestamp.month();
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
    const now = moment(); // should come from state?
    const fraction = now.date() / now.daysInMonth();
    if (fraction > 0.1) {
      const month = now.month(); // 0-based
      data[month].thisYearProjected = data[month].thisYear / fraction;
    }
  }

  const thisYearLabel = thisYearRange.start().format('YYYY');
  const lastYearLabel = lastYearRange.start().format('YYYY');

  return {
      data,
      xDomain: data.map(row => row.x), // ordinal axis, so must include each specific point
      xTickFormat: formatMonth,
      xTooltipFormat: formatFullMonth,
      series: [
        {
          label: lastYearLabel,
          tooltipLabel: `${lastYearLabel} actual`,
          valueKey: "lastYear", type: "bar",
          cluster: "lastYear", color: chartColors.compare
        },
        {
          label: "(projected)",
          tooltipLabel: `${thisYearLabel} projected`,
          hideLegend: true,
          valueKey: "thisYearProjected", type: "bar",
          cluster: "thisYear", color: chartColors.primary, fill: "transparent"
        },
        {
          label: thisYearLabel,
          tooltipLabel: `${thisYearLabel} actual`,
          valueKey: "thisYear", type: "bar", cluster: "thisYear", color: chartColors.primary
        },
        {
          label: `Avg ${averageRange.start().format('YYYY')}–${averageRange.end().format('YY')}`,
          tooltipLabel: `${averageYears}-year average`,
          valueKey: "average", type: "hash",
          color: chartColors.trend, stroke: "none"
        },
      ],
  };
}

const PastYearChart = connect(selectPastYearChart)(Chart);


//
// PastYear view
//

export default function PastYear() {
  return (
    <Section
      title="This year"
      chart={<PastYearChart/>}
      >
      <PastYearScorecard/>
    </Section>
  );
}
