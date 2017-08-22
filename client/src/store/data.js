import filter from 'lodash/filter';
import groupBy from 'lodash/groupBy';
import keyBy from 'lodash/keyBy';
import mapObject from 'lodash/mapValues';
import filterObject from 'lodash/pickBy';
import size from 'lodash/size';
import values from 'lodash/values';
import moment from 'moment';
import 'twix'; // extends moment

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
  // maps of timestampField: {row} (to simplify merging)
  recent: {},
  daily: {},
  monthly: {},
  // freshness
  lastUpdate: {
    recent: undefined,
    daily: undefined,
    monthly: undefined,
  },
};


export default function reducer(state=initialState, action) {
  switch (action.type) {
    case FETCH_DATA_SUCCESS: {
      const {reportType, data, timestamp} = action.payload;
      let newState = {
        ...state,
        [reportType]: processReportData(reportType, data),
        lastUpdate: {
          ...state.lastUpdate,
          [reportType]: timestamp,
        }
      };
      newState = updateDailyWithRecent(newState);
      newState = updateMonthlyWithDaily(newState);
      return newState;
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
        ({data, timestamp}) => dispatch(fetchDataSuccess(reportType, data, timestamp)),
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
  recent: {
    timestampField: 'time',
    timestampFormat: 'YYYY-MM-DD HH:mm:ssZ',
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
  // adds parsed moment timestamp for start of period
  // adds usageGals calculated from usage_cuft
  // converts array to object keyed by (string) time field
  const {timestampField, timestampFormat} = REPORTS[reportType];
  const augmentedData = data.map((row) => {
    const timestamp = moment(row[timestampField], timestampFormat, /*strict=*/true);
    const usageGals = row.usage_cuft * GALLONS_PER_CUFT;
    return {...row, timestamp, usageGals};
  });
  return keyBy(augmentedData, timestampField);
}


function synthesizeReportData(fromData, fromType, toType) {
  // groups and summarizes one type of report from more detailed data;
  // fromData must be object in same format as store.data[fromType]
  // toType must be larger than toType (monthly > daily > recent)
  // result is object in same format as would be returned by processReportData(toType, serverResponse)

  const {timestampField: fromTimestampField} = REPORTS[fromType];
  const {timestampField: toTimestampField, timestampFormat: toTimestampFormat} = REPORTS[toType];

  // This relies on toTimestampField being a prefix of fromTypestampField
  const toTimestampLength = toTimestampFormat.length;
  const groupedByToTimestamp = groupBy(fromData,
      row => row[fromTimestampField].slice(0, toTimestampLength));
  const result = mapObject(groupedByToTimestamp,
    (fromRows, toTimestamp) => fromRows.reduce((toRow, row) => {
      toRow.num_readings += (row.num_readings || 1);
      toRow.usage_cuft += row.usage_cuft;
      toRow.usageGals = toRow.usage_cuft * GALLONS_PER_CUFT; // (adding usageGals accumulates errors; always recalc)
      return toRow;
    }, { // initial toRow:
      [toTimestampField]: toTimestamp,
      timestamp: moment(toTimestamp, toTimestampFormat, /*strict=*/true),
      num_readings: 0,
      // last_reading_cuft: ???
      usage_cuft: 0,
      usageGals: 0,
    }));
  return result;
}


const EPSILON = 0.000001;
function _definitelyGreaterThan(a, b) {
  return (a - b) > EPSILON;
}

function mergeReportData(origData, mergeData) {
  // returns a new object that:
  //   replaces origData items with corresponding mergeData items with greater usage
  //   inserts mergeData items into origData for any missing ones
  // or if no changes, returns origData intact

  const toMerge = filterObject(mergeData, (row, key) => (
    !origData.hasOwnProperty(key)
    || _definitelyGreaterThan(row.usage_cuft, origData[key].usage_cuft)
  ));
  if (size(toMerge) > 0) {
    return {
      ...origData,
      ...toMerge,
    };
  } else {
    return origData;
  }
}


function updateDailyWithRecent(state) {
  const {daily, recent} = state;
  const synthesizedDaily = synthesizeReportData(recent, 'recent', 'daily');
  const mergedDaily = mergeReportData(daily, synthesizedDaily);
  if (mergedDaily !== daily) {
    return {...state, daily: mergedDaily};
  } else {
    return state;
  }
}


function updateMonthlyWithDaily(state) {
  const {monthly, daily} = state;
  const synthesizedMonthly = synthesizeReportData(daily, 'daily', 'monthly');
  const mergedMonthly = mergeReportData(monthly, synthesizedMonthly);
  if (mergedMonthly !== monthly) {
    return {...state, monthly: mergedMonthly};
  } else {
    return state;
  }
}


//
// Selectors
//

function selectData(state, type, range=undefined) {
  // returns Array of rows; caution: may not be sorted
  const {data} = state;
  let result;
  if (range) {
    // lodash filter iterates object values, returns Array;
    // FUTURE: use string filtering (timestampField) to avoid timezone issues
    //    (filter predicate is called with (value, key, object))
    result = filter(data[type], row => range.contains(row.timestamp));
  } else {
    result = values(data[type]);
  }
  return result;
}

export function selectRecentData(state, range=undefined) {
  return selectData(state, 'recent', range);
}

export function selectDailyData(state, range=undefined) {
  return selectData(state, 'daily', range);
}

export function selectMonthlyData(state, range=undefined) {
  return selectData(state, 'monthly', range);
}


export function selectLastUpdate(state, type) {
  // unix timestamp, or undefined if not yet loaded
  const {data: {lastUpdate}} = state;
  return lastUpdate[type];
}
