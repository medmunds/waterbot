import {
  FETCH_DATA_REQUEST, FETCH_DATA_SUCCESS, FETCH_DATA_FAILURE
} from "./actions";

const initialState = {
  // network state
  pendingFetchCount: 0,

  // reporting UI
  day: {
    endTimestamp: undefined, // timestamp of right edge of chart; left is calculated
  },
  month: {
    endTimestamp: undefined, // timestamp of right edge of chart; left is calculated
  },
  ytd: {
    year: undefined,
  },
};

export default function reducer(state=initialState, action) {
  switch (action.type) {
    case FETCH_DATA_REQUEST: {
      let {pendingFetchCount} = state;
      pendingFetchCount += 1;
      return {...state, pendingFetchCount};
    }
    case FETCH_DATA_SUCCESS:
    case FETCH_DATA_FAILURE: {
      let {pendingFetchCount} = state;
      pendingFetchCount -= 1;
      return {...state, pendingFetchCount};
    }
    default:
      return state;
  }
}


export function selectPendingNetworkActivity(state) {
  const {ui: {pendingFetchCount}} = state;

  return pendingFetchCount > 0;
}
