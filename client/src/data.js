import moment from 'moment';

const reportUrl = 'https://us-central1-molten-turbine-171801.cloudfunctions.net/report';
const deviceId = '31001a001047343438323536'; // live waterbot
const reportingTimezone = 'US/Pacific';
const GALLONS_PER_CUFT = 7.48052;


const initialData = {
  hourly: [],
  daily: [],
  monthly: [],
  now: undefined,
};


export function reducer(state=initialData, action={}) {
  switch (action.type) {
    case 'REPORT_LOADED':
      const {reportType, data} = action.payload;
      if (['hourly', 'daily', 'monthly'].indexOf(reportType) < 0) {
        throw new Error(`Unknown reportType '${reportType}' in ${action.type} action`);
      }
      if (!Array.isArray(data)) {
        throw new Error(`Data must be Array, not ${typeof data}, in ${action.type} action`);
      }
      return {...state, [reportType]: data};
    case 'SET_NOW':
      const {now} = action.payload;
      return {...state, now};
    default:
      return state;
  }
}


export function fetchReport(reportType='daily') {
  const params = {
    type: reportType,
    device_id: deviceId,
    timezone: reportingTimezone,
  };
  const encodedParams = Object.keys(params).map(
    key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
  ).join('&');
  return fetch(`${reportUrl}?${encodedParams}`)
    .then(response => response.json())
    .then(({data}) => ({
      type: 'REPORT_LOADED',
      payload: {reportType, data},
    }));
}


// All ranges are inclusive of [start, end]

function last24HoursRange(now) {
  const start = moment(now).startOf('hour').subtract(24, 'hours');
  const end = moment(now).endOf('hour');
  return {start, end};
}

function last30DaysRange(now) {
  const start = moment(now).startOf('day').subtract(30, 'days');
  const end = moment(now).endOf('day');
  return {start, end};
}

function yearToDateRange(now) {
  const start = moment(now).startOf('year');
  const end = moment(now).endOf('day');
  return {start, end};
}

function thisYearRange(now) {
  const start = moment(now).startOf('year');
  const end = moment(now).endOf('year');
  return {start, end};
}


const FORMAT_HOUR = 'YYYY-MM-DD HH';
const FORMAT_DAY = 'YYYY-MM-DD';
const FORMAT_MONTH = 'YYYY-MM';

function filterRowsInRange(rows, start, end, filterField, format) {
  const startFilter = start.format(format);
  const endFilter = end.format(format);
  return rows.filter(row => row[filterField] >= startFilter && row[filterField] <= endFilter);
}


export function selectLast24HoursScorecard(state) {
  const {now, hourly} = state;
  const {start, end} = last24HoursRange(now);
  const totalUsageGals = GALLONS_PER_CUFT *
    filterRowsInRange(hourly, start, end, 'hour', FORMAT_HOUR)
    .reduce((total, row) => total + row.usage_cuft, 0);

  return {
    value: totalUsageGals,
    fractionDigits: 1,
    unitLabel: "gals",
  };
}

export function selectLast24HoursChart(state) {
  const {now, hourly} = state;
  const {start, end} = last24HoursRange(now);
  const data = filterRowsInRange(hourly, start, end, 'hour', FORMAT_HOUR)
    .map(row => ({
      x: moment(row.hour, FORMAT_HOUR),
      y: row.usage_cuft * GALLONS_PER_CUFT,
    }));

  return {
    start, end, data,
  };
}

export function selectLast30DaysScorecard(state) {
  const {now, daily} = state;
  const {start, end} = last30DaysRange(now);
  const totalUsageGals = GALLONS_PER_CUFT *
    filterRowsInRange(daily, start, end, 'date', FORMAT_DAY)
    .reduce((total, row) => total + row.usage_cuft, 0);
  // TODO: use fresher `hourly` data for current day

  const lastYearStart = start.clone().subtract(1, 'year');
  const lastYearEnd = end.clone().subtract(1, 'year');
  const lastYearUsage = GALLONS_PER_CUFT *
    filterRowsInRange(daily, lastYearStart, lastYearEnd, 'date', FORMAT_DAY)
    .reduce((total, row) => total + row.usage_cuft, 0);

  return {
    value: totalUsageGals,
    unitLabel: "gals",
    comparisonValue: lastYearUsage,
    comparisonLabel: `last year (${start.format('M/D')}–${end.format('M/D')})`,
  };
}

export function selectLast30DaysChart(state) {
  const {now, daily} = state;
  const {start, end} = last30DaysRange(now);
  const data = filterRowsInRange(daily, start, end, 'date', FORMAT_DAY)
    .map(row => ({
      x: moment(row.date, FORMAT_DAY),
      y: row.usage_cuft * GALLONS_PER_CUFT,
    }));

  return {
    start, end, data,
  };
}

export function selectYearToDateScorecard(state) {
  // This is an exact copy of selectLast30DaysScorecard with a different date range
  const {now, daily} = state;
  const {start, end} = yearToDateRange(now);
  const totalUsageGals = GALLONS_PER_CUFT *
    filterRowsInRange(daily, start, end, 'date', FORMAT_DAY)
    .reduce((total, row) => total + row.usage_cuft, 0);
  // TODO: use fresher `hourly` data for current day

  const lastYearStart = start.clone().subtract(1, 'year');
  const lastYearEnd = end.clone().subtract(1, 'year');
  const lastYearUsage = GALLONS_PER_CUFT *
    filterRowsInRange(daily, lastYearStart, lastYearEnd, 'date', FORMAT_DAY)
    .reduce((total, row) => total + row.usage_cuft, 0);

  return {
    value: totalUsageGals,
    unitLabel: "gals",
    comparisonValue: lastYearUsage,
    comparisonLabel: `last year (${start.format('M/D')}–${end.format('M/D')})`,
  };
}

export function selectThisYearChart(state) {
  const {now, monthly} = state;

  const yearChartRow = (row) => ({
    x: moment(row.month, FORMAT_MONTH).month(), // 0-11
    y: row.usage_cuft * GALLONS_PER_CUFT,
  });

  const {start, end} = thisYearRange(now);
  const thisYearData = filterRowsInRange(monthly, start, end, 'month', FORMAT_MONTH).map(yearChartRow);

  const lastYearStart = start.clone().subtract(1, 'year');
  const lastYearEnd = end.clone().subtract(1, 'year');
  const lastYearData = filterRowsInRange(monthly, lastYearStart, lastYearEnd, 'month', FORMAT_MONTH)
    .map(yearChartRow);

  // TODO: split last year for current month
  // TODO: add 5-year average

  return {
    start: 0,
    end: 11,
    series: [
      {label: start.format('YYYY'), data: thisYearData},
      {label: lastYearStart.format('YYYY'), data: lastYearData},
    ],
  };
}
