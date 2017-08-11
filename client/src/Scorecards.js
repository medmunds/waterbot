// import React from 'react';
import {connect} from 'react-redux';
import Scorecard from "./components/Scorecard";
import {selectLast24HoursScorecard, selectLast30DaysScorecard, selectYearToDateScorecard} from "./store/data";


export const ScorecardLast24Hours = connect(selectLast24HoursScorecard)(Scorecard);
export const ScorecardLast30Days = connect(selectLast30DaysScorecard)(Scorecard);
export const ScorecardYearToDate = connect(selectYearToDateScorecard)(Scorecard);
