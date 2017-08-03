import React, { Component } from 'react';
import {ChartLast24Hours, ChartLast30Days, ChartThisYear} from './Charts';
import {fetchReport, reducer} from './data';
import {ScorecardLast24Hours, ScorecardLast30Days, ScorecardYearToDate} from "./Scorecards";

import './App.css';


class App extends Component {

  constructor() {
    super();
    this.state = reducer();
  }

  componentDidMount() {
    const handleReport = (action) => this.setState((state, props) => reducer(state, action));
    fetchReport('hourly').then(handleReport);
    fetchReport('daily').then(handleReport);
    fetchReport('monthly').then(handleReport);
  }

  render() {
    const state = this.state;

    return (
      <main className="App">
        <h1>Waterbot dashboard</h1>
        <section>
          <h2>Last 24 hours</h2>
          <ScorecardLast24Hours state={state}/>
          <div className="chart">
            <ChartLast24Hours state={state}/>
          </div>
        </section>
        <section>
          <h2>Last 30 days</h2>
          <ScorecardLast30Days state={state}/>
          <div className="chart">
            <ChartLast30Days state={state}/>
          </div>
        </section>
        <section>
          <h2>This year</h2>
          <ScorecardYearToDate state={state}/>
          <div className="chart">
            <ChartThisYear state={state}/>
          </div>
        </section>
        <section>
          <h2>Meter info</h2>
        </section>
      </main>
    );
  }
}

export default App;
