import filter from 'lodash/filter';
import groupBy from 'lodash/groupBy';
import keyBy from 'lodash/keyBy';
import map from 'lodash/map';
import mapObject from 'lodash/mapValues';
import filterObject from 'lodash/pickBy';
import size from 'lodash/size';
import values from 'lodash/values';
import moment from 'moment';
import 'twix'; // extends moment

import {
  FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_FAILURE,
  fetchDataRequest, fetchDataSuccess, fetchDataFailure
} from "./actions";
import {
  siteId,
  GALLONS_PER_LITER,
  reportingTimezone,
  reportUrl
} from "../config";



const initialState = {
  // maps of label: {row} (to simplify merging)
  device: {},
  minutely: {},
  daily: {},
  monthly: {},
  // freshness
  lastUpdate: {
    device: undefined,
    minutely: undefined,
    daily: undefined,
    monthly: undefined,
  },
  errors: {
    device: undefined,
    minutely: undefined,
    daily: undefined,
    monthly: undefined,
  },
};


export default function reducer(state=initialState, action) {
  switch (action.type) {
    case FETCH_DATA_REQUEST: {
      const {reportType} = action.payload;
      if (state.errors[reportType]) {
        return {...state, errors: {...state.errors, [reportType]: undefined}};
      } else {
        return state;
      }
    }
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
      if (reportType !== 'device') {
        newState = updateDailyWithMinutely(newState);
        newState = updateMonthlyWithDaily(newState);
      }
      return newState;
    }
    case FETCH_DATA_FAILURE: {
      const {reportType, error} = action.payload;
      return {
        ...state,
        errors: {
          ...state.errors,
          [reportType]: error,
        },
      };
    }
    default:
      return state;
  }
}


function fetchReport(reportType) {
  const params = {
    type: reportType,
    site_id: siteId,
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
    dispatch(fetchData('minutely'));
    dispatch(fetchData('daily'));
    dispatch(fetchData('monthly'));
    dispatch(fetchData('device'));
  };
}


const REPORTS = {
  device: {
    labelFormat: 'YYYY-MM-DD HH:mm:ssZ',
  },
  minutely: {
    labelFormat: 'YYYY-MM-DD HH:mm:ssZ',
  },
  daily: {
    labelFormat: 'YYYY-MM-DD',
  },
  monthly: {
    labelFormat: 'YYYY-MM',
  },
};

export const VALID_REPORT_TYPES = Object.keys(REPORTS);

function processReportData(reportType, data) {
  // adds parsed moment timestamp for start of period
  // adds usageGals calculated from usage_liters
  // converts array to object keyed by (string) time field
  const {labelFormat} = REPORTS[reportType];
  const augmentedData = data.map((row) => {
    const timestamp = moment(row.label, labelFormat, /*strict=*/true);
    const usageGals = row.usage_liters * GALLONS_PER_LITER;
    return {...row, timestamp, usageGals};
  });
  return keyBy(augmentedData, 'label');
}


function synthesizeReportData(fromData, fromType, toType) {
  // groups and summarizes one type of report from more detailed data;
  // fromData must be object in same format as store.data[fromType]
  // toType must be larger than toType (monthly > daily > recent)
  // result is object in same format as would be returned by processReportData(toType, serverResponse)

  const {labelFormat: fromLabelFormat} = REPORTS[fromType];
  const {labelFormat: toLabelFormat} = REPORTS[toType];

  // This relies on to.label being a prefix of from.label
  const toLabelLength = toLabelFormat.length;
  if (fromLabelFormat.length <= toLabelLength) {
    throw new Error(`Cannot synthesize ${toType} from ${fromType}`);
  }

  const groupedByToLabel = groupBy(fromData, row => row.label.slice(0, toLabelLength));
  const result = mapObject(groupedByToLabel,
    (fromRows, toLabel) => fromRows.reduce((toRow, row) => {
      toRow.usage_liters += row.usage_liters;
      toRow.usageGals = toRow.usage_liters * GALLONS_PER_LITER; // (adding usageGals accumulates errors; always recalc)
      return toRow;
    }, { // initial toRow:
      label: toLabel,
      timestamp: moment(toLabel, toLabelFormat, /*strict=*/true),
      usage_liters: 0,
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
    || _definitelyGreaterThan(row.usage_liters, origData[key].usage_liters)
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


function updateDailyWithMinutely(state) {
  const {daily, recent} = state;
  const synthesizedDaily = synthesizeReportData(recent, 'minutely', 'daily');
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
    // FUTURE: use string filtering (on label field) to avoid timezone issues
    //    (filter predicate is called with (value, key, object))
    result = filter(data[type], row => range.contains(row.timestamp));
  } else {
    result = values(data[type]);
  }
  return result;
}

export function selectDeviceData(state, range=undefined) {
  return selectData(state, 'device', range);
}

export function selectMinutelyData(state, range=undefined) {
  return selectData(state, 'minutely', range);
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


export function selectErrorMessages(state) {
  const {data: {errors}} = state;
  return map(
    filterObject(errors),
    (error, reportType) => `Problem loading ${reportType} data: ${error.message || error}`
  );
}
