import moment from 'moment';
import {
  FETCH_DATA_SUCCESS,
  fetchDataRequest, fetchDataSuccess, fetchDataFailure
} from "./actions";


const reportUrl = 'https://us-central1-molten-turbine-171801.cloudfunctions.net/report';
const deviceId = '31001a001047343438323536'; // live waterbot
const reportingTimezone = 'US/Pacific';
const GALLONS_PER_CUFT = 7.48052;

const FORMAT_HOUR = 'YYYY-MM-DD HH';
const FORMAT_DATE = 'YYYY-MM-DD';
const FORMAT_MONTH = 'YYYY-MM';


const initialState = {
  hourly: {}, // map 'YYYY-MM-DD HH' --> {usageGals, wifiSignal, batteryPct}
  daily: {}, // map 'YYYY-MM-DD' --> {usageGals}
  monthly: {}, // map 'YYYY-MM' --> {usageGals}
  latest: {
    timestamp: undefined,
    readingCuFt: undefined,
    wifiSignal: undefined,
    batteryPct: undefined,
  },
};


export default function reducer(state=initialState, action) {
  switch (action.type) {
    case FETCH_DATA_SUCCESS: {
      const {reportType, data} = action.payload;
      return {...state, [reportType]: processReportData(reportType, data)};
    }
    default:
      return state;
  }
}


function fetchReport(reportType) {
  const params = {
    type: reportType,
    device_id: deviceId,
    timezone: reportingTimezone,
  };
  const encodedParams = Object.keys(params).map(
    key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
  ).join('&');
  return fetch(`${reportUrl}?${encodedParams}`)
    .then(response => response.json());
}

export function fetchData(reportType) {
  return function(dispatch) {
    dispatch(fetchDataRequest(reportType));

    return fetchReport(reportType)
      .then(
        ({data}) => dispatch(fetchDataSuccess(reportType, data)),
        error => dispatch(fetchDataFailure(reportType, error))
      );
  };
}

export function refreshAll() {
  return function(dispatch) {
    dispatch(fetchData('hourly'));
    dispatch(fetchData('daily'));
    dispatch(fetchData('monthly'));
  };
}



const REPORTS = {
  hourly: {
    timestampField: 'hour',
    timestampFormat: FORMAT_HOUR,
  },
  daily: {
    timestampField: 'date',
    timestampFormat: FORMAT_DATE,
  },
  monthly: {
    timestampField: 'month',
    timestampFormat: FORMAT_MONTH,
  },
};

export const VALID_REPORT_TYPES = Object.keys(REPORTS);

function processReportData(reportType, data) {
  const {timestampField, timestampFormat} = REPORTS[reportType];
  return data.reduce((processed, row) => {
    const timestampStr = row[timestampField];
    const timestamp = +moment(timestampStr, timestampFormat); // need to force timezone?
    const usageGals = row.usage_cuft * GALLONS_PER_CUFT;
    processed[timestampStr] = {...row, timestamp, timestampStr, usageGals};
    return processed;
  }, {});
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


function filterRowsInRange(data, start, end, format) {
  const startFilter = start.format(format);
  const endFilter = end.format(format);
  return Object.keys(data)
    .filter(key => startFilter <= key && key <= endFilter)
    .map(key => data[key]);
}


export function selectLast24HoursScorecard(state) {
  const {data: {hourly}, ui: {day: {endTimestamp}}} = state;
  const {start, end} = last24HoursRange(endTimestamp);
  const totalUsageGals = GALLONS_PER_CUFT *
    filterRowsInRange(hourly, start, end, FORMAT_HOUR)
    .reduce((total, row) => total + row.usage_cuft, 0);

  return {
    value: totalUsageGals,
    fractionDigits: 1,
    unitLabel: "gals",
  };
}

export function selectLast30DaysScorecard(state) {
  const {data: {daily}, ui: {month: {endTimestamp}}} = state;
  const {start, end} = last30DaysRange(endTimestamp);
  const totalUsageGals = filterRowsInRange(daily, start, end, FORMAT_DATE)
    .reduce((total, row) => total + row.usageGals, 0);
  // TODO: use fresher `hourly` data for current day

  const lastYearStart = start.clone().subtract(1, 'year');
  const lastYearEnd = end.clone().subtract(1, 'year');
  const lastYearUsage = filterRowsInRange(daily, lastYearStart, lastYearEnd, FORMAT_DATE)
    .reduce((total, row) => total + row.usageGals, 0);

  return {
    value: totalUsageGals,
    unitLabel: "gals",
    comparisonValue: lastYearUsage,
    comparisonLabel: `last year (${start.format('M/D')}–${end.format('M/D')})`,
  };
}

export function selectYearToDateScorecard(state) {
  // This is very similar to selectLast30DaysScorecard with a different date range
  const {data: {daily}, ui: {ytd: {year}}} = state;
  const start = year ? moment({year}) : moment().startOf('year');
  const end = moment().endOf('day'); // TODO: full year if not current year (based latest report timestamp)
  const totalUsageGals = filterRowsInRange(daily, start, end, FORMAT_DATE)
    .reduce((total, row) => total + row.usageGals, 0);
  // TODO: use fresher `hourly` data for current day

  const lastYearStart = start.clone().subtract(1, 'year');
  const lastYearEnd = end.clone().subtract(1, 'year');
  const lastYearUsage = filterRowsInRange(daily, lastYearStart, lastYearEnd, FORMAT_DATE)
    .reduce((total, row) => total + row.usageGals, 0);

  return {
    value: totalUsageGals,
    unitLabel: "gals",
    comparisonValue: lastYearUsage,
    comparisonLabel: `last year (${start.format('M/D')}–${end.format('M/D')})`,
  };
}
