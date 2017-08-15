import React from 'react';
import {
  XYPlot, LineSeries, YAxis,
} from 'react-vis';

import './Sparkline.css';


export default function Sparkline({
  data,
  width=120,
  height=24,
  ...props,
}) {
  // react-vis LineSeries doesn't handle missing data (https://github.com/uber/react-vis/issues/457)
  data = data.filter(({y}) => (y !== undefined && y !== null));

  return (
    <XYPlot
      width={width} height={height}
      className="Sparkline"
      margin={{left: 1, right: 1, top: 1, bottom: 1}}
      {...props}
    >
      <YAxis tickTotal={0}/>
      <LineSeries data={data} color="#4285F5"/>
    </XYPlot>
  );
}
