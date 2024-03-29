import React, {useEffect} from 'react';
import PageFooter from "../components/PageFooter";
import PageTitle from "../components/PageTitle";
import DataLoadingErrors from "./DataLoadingErrors";
import PastMonth from './PastMonth';
import PastYear from './PastYear';
import NetworkIndicator from "./NetworkIndicator";
import {RecentActivity, DeviceStatus} from './RecentActivity';

import {reportingTimezone} from "../config";


export default function App({onRefresh}) {
  useEffect(onRefresh);
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
        <DeviceStatus/>
      </main>
      <PageFooter>
        <div>All times are {reportingTimezone}</div>
        <div>About the <a href="https://www.permaculture-sf.org/garden">18th &amp; RI Permaculture Garden</a></div>
        <div><a href="https://github.com/medmunds/waterbot">Waterbot</a> info &amp; code</div>
      </PageFooter>
    </div>
  );
}
