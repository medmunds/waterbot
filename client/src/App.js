import React from 'react';
import {ChartLast24Hours, ChartLast30Days, ChartThisYear} from './Charts';
import {CurrentMeter, CurrentBattery, CurrentWiFi} from './CurrentInfo';
import {ScorecardLast24Hours, ScorecardLast30Days, ScorecardYearToDate} from "./Scorecards";
import PageTitle from "./components/PageTitle";
import Section from "./components/Section";

import './App.css';


export default function App() {
  return (
    <main className="App">
      <PageTitle>18th &amp; Rhode Island Permaculture Garden water usage</PageTitle>
      <Section
        title="Last 30 days"
        chart={<ChartLast30Days/>}
        >
        <ScorecardLast30Days/>
      </Section>
      <Section
        title="This year"
        chart={<ChartThisYear/>}
      >
        <ScorecardYearToDate/>
      </Section>
      <Section
        title="Recent activity"
        chart={<ChartLast24Hours/>}
      >
        <ScorecardLast24Hours/>
        <CurrentMeter/>
        <CurrentBattery/>
        <CurrentWiFi/>
      </Section>
    </main>
  );
}
