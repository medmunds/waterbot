import React from 'react';
import Scorecard from "./components/Scorecard";
import {selectLast24HoursScorecard, selectLast30DaysScorecard, selectYearToDateScorecard} from "./data";


export function ScorecardLast24Hours({state}) {
  return <Scorecard {...selectLast24HoursScorecard(state)}/>
}

export function ScorecardLast30Days({state}) {
  return <Scorecard {...selectLast30DaysScorecard(state)}/>
}

export function ScorecardYearToDate({state}) {
  return <Scorecard {...selectYearToDateScorecard(state)}/>
}
