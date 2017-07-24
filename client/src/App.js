import React, { Component } from 'react';
import {VictoryTheme} from 'victory';

import './App.css';
import {HourlyChart, DailyChart, MonthlyChart} from './components/Charts';
import Scorecard from './components/Scorecard';
import {fetchJsonLines} from './data';


class App extends Component {

  constructor() {
    super();
    this.state = {
      hourlyData: undefined,
      dailyData: undefined,
      monthlyData: undefined,
    };
  }

  componentDidMount() {
    const self = this;
    fetchJsonLines('./reports-hourly.jsonl')
      .then(hourlyData => {
        self.setState({hourlyData});
      });
    fetchJsonLines('./reports-daily.jsonl')
      .then(dailyData => {
        self.setState({dailyData});
      });
    fetchJsonLines('./reports-monthly.jsonl')
      .then(monthlyData => {
        self.setState({monthlyData});
      });
  }

  render() {
    const {hourlyData, dailyData, monthlyData} = this.state;
    const theme = VictoryTheme.material;
    const now = "2017-07-21 18:00:00-0700";

    return (
      <main className="App">
        <h1>Waterbot dashboard</h1>
        <section>
          <h2>Last 24 hours</h2>
          <Scorecard value={123.45} fractionDigits={1} unitLabel="gal"/>
          <div className="chart">
            {hourlyData
              ? <HourlyChart hourlyData={hourlyData} now={now} theme={theme}/>
              : <p>Loading&hellip;</p>
            }
          </div>
        </section>
        <section>
          <h2>Last 30 days</h2>
          <Scorecard value={4567.12} unitLabel="gal"/>
          <div className="chart">
            {dailyData
              ? <DailyChart dailyData={dailyData} now={now} theme={theme}/>
              : <p>Loading&hellip;</p>
            }
          </div>
        </section>
        <section>
          <h2>This year</h2>
          <Scorecard value={19876.54} unitLabel="gal"/>
          <div className="chart">
            {monthlyData
              ? <MonthlyChart monthlyData={monthlyData} now={now} theme={theme}/>
              : <p>Loading&hellip;</p>
            }
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
