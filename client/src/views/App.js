import React from 'react';
import PageFooter from "../components/PageFooter";
import PageTitle from "../components/PageTitle";
import DataLoadingErrors from "./DataLoadingErrors";
import PastMonth from './PastMonth';
import PastYear from './PastYear';
import NetworkIndicator from "./NetworkIndicator";
import RecentActivity from './RecentActivity';

import {reportingTimezone} from "../config";


export default function App() {
  return (
    <div>
      <NetworkIndicator/>
      <PageTitle
        supertitle={<span>18th &amp; Rhode Island Permaculture&nbsp;Garden</span>}
        title="Water usage"
      />
      <main>
        <DataLoadingErrors/>
        <PastMonth/>
        <PastYear/>
        <RecentActivity/>
      </main>
      <PageFooter>
        <div>All times are {reportingTimezone}</div>
        <div>About <a href="http://www.permaculture-sf.org/">Permaculture San Francisco</a></div>
        <div><a href="https://github.com/medmunds/waterbot">Waterbot</a> info &amp; code</div>
      </PageFooter>
    </div>
  );
}
