// Action constants

const prefix = "waterbot/";

export const FETCH_DATA_REQUEST = `${prefix}FETCH_DATA_REQUEST`;
export const FETCH_DATA_SUCCESS = `${prefix}FETCH_DATA_SUCCESS`;
export const FETCH_DATA_FAILURE = `${prefix}FETCH_DATA_FAILURE`;


// Action creators

export function fetchDataRequest(reportType) {
  return {
    type: FETCH_DATA_REQUEST,
    payload: {reportType}
  };
}

export function fetchDataSuccess(reportType, data) {
  return {
    type: FETCH_DATA_SUCCESS,
    payload: {reportType, data}
  };
}

export function fetchDataFailure(reportType, error) {
  return {
    type: FETCH_DATA_FAILURE,
    payload: {reportType, error}
  };
}
