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
      <PageTitle>18th &amp; Rhode Island Permaculture Garden water usage</PageTitle>
      <PastMonth/>
      <PastYear/>
      <RecentActivity/>
    </main>
  );
}
