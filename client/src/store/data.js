import moment from 'moment';
import {
  FETCH_DATA_SUCCESS,
  fetchDataRequest, fetchDataSuccess, fetchDataFailure
} from "./actions";
import {
  deviceId,
  GALLONS_PER_CUFT,
  reportingTimezone,
  reportUrl
} from "../config";



const initialState = {
  recent: [],
  hourly: {}, // map 'YYYY-MM-DD HH' --> {usageGals, wifiSignal, batteryPct}
  daily: {}, // map 'YYYY-MM-DD' --> {usageGals}
  monthly: {}, // map 'YYYY-MM' --> {usageGals}
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
    dispatch(fetchData('recent'));
    // dispatch(fetchData('hourly'));
    dispatch(fetchData('daily'));
    dispatch(fetchData('monthly'));
  };
}


const REPORTS = {
  hourly: {
    timestampField: 'hour',
    timestampFormat: 'YYYY-MM-DD HH',
  },
  daily: {
    timestampField: 'date',
    timestampFormat: 'YYYY-MM-DD',
  },
  monthly: {
    timestampField: 'month',
    timestampFormat: 'YYYY-MM',
  },
};

export const VALID_REPORT_TYPES = Object.keys(REPORTS);

function processReportData(reportType, data) {
  if (reportType === 'recent') {
    data.forEach(row => {
      row.timestamp = moment.unix(row.timestamp);
      row.usageGals = row.usage_cuft * GALLONS_PER_CUFT;
    });
    return data;
  }

  const {timestampField, timestampFormat} = REPORTS[reportType];
  return data.reduce((processed, row) => {
    const timestampStr = row[timestampField];
    const timestamp = +moment(timestampStr, timestampFormat); // need to force timezone?
    const usageGals = row.usage_cuft * GALLONS_PER_CUFT;
    processed[timestampStr] = {...row, timestamp, timestampStr, usageGals};
    return processed;
  }, {});
}


export function selectRecentData(state, range=undefined) {
  const {data: {recent}} = state;
  let data = recent;
  if (range) {
    data = data.filter(row => range.contains(row.timestamp));
  }
  return data;
}

export function selectDailyData(state, range=undefined) {
  const {data: {daily}} = state;
  let data = Object.values(daily);
  if (range) {
    data = data.filter(row => range.contains(row.timestamp));
  }

  // FUTURE: update data from recent if range overlaps recent timestamps
  return data;
}

export function selectMonthlyData(state, range=undefined) {
  const {data: {monthly}} = state;
  let data = Object.values(monthly);

  if (range) {
    data = data.filter(row => range.contains(row.timestamp));
  }

  // FUTURE: update data from selectDailyData if range overlaps
  return data;
}
