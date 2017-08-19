import React from 'react';
import PageTitle from "../components/PageTitle";
import PastMonth from './PastMonth';
import PastYear from './PastYear';
import RecentActivity from './RecentActivity';


export default function App() {
  return (
    <main>
      <PageTitle>18th &amp; Rhode Island Permaculture Garden water usage</PageTitle>
      <PastMonth/>
      <PastYear/>
      <RecentActivity/>
    </main>
  );
}
