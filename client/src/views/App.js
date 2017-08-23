import React from 'react';
import PageTitle from "../components/PageTitle";
import PastMonth from './PastMonth';
import PastYear from './PastYear';
import NetworkIndicator from "./NetworkIndicator";
import RecentActivity from './RecentActivity';


export default function App() {
  return (
    <main>
      <NetworkIndicator/>
      <PageTitle
        supertitle={<span>18th &amp; Rhode Island Permaculture&nbsp;Garden</span>}
        title="Water usage"
      />
      <PastMonth/>
      <PastYear/>
      <RecentActivity/>
    </main>
  );
}
