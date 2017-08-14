import React from 'react';
import {ChartLast24Hours, ChartLast30Days, ChartThisYear} from './Charts';
import {CurrentMeter, CurrentBattery, CurrentWiFi} from './CurrentInfo';
import {ScorecardLast24Hours, ScorecardLast30Days, ScorecardYearToDate} from "./Scorecards";

import './App.css';


export default function App() {
  return (
    <main className="App">
      <h1>18th &amp; Rhode Island Permaculture Garden water usage</h1>
      <section>
        <h2>Last 24 hours</h2>
        <ScorecardLast24Hours/>
        <div className="chart">
          <ChartLast24Hours/>
        </div>
      </section>
      <section>
        <h2>Last 30 days</h2>
        <ScorecardLast30Days/>
        <div className="chart">
          <ChartLast30Days/>
        </div>
      </section>
      <section>
        <h2>This year</h2>
        <ScorecardYearToDate/>
        <div className="chart">
          <ChartThisYear/>
        </div>
      </section>
      <section>
        <h2>Meter info</h2>
        <div className="current-info">
          <CurrentMeter/>
          <CurrentBattery/>
          <CurrentWiFi/>
        </div>
      </section>
    </main>
  );
}
