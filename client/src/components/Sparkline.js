import React from 'react';
// import {XYPlot, LineSeries, YAxis} from 'react-vis';
import LineSeries from "react-vis/es/plot/series/line-series";
import XYPlot from "react-vis/es/plot/xy-plot";
import YAxis from "react-vis/es/plot/axis/y-axis";

import {chartColors} from '../theme';

import './Sparkline.css';


export default function Sparkline({
  data,
  width=120,
  height=24,
  color=chartColors.primary,
  ...props
}) {
  return (
    <XYPlot
      width={width} height={height}
      className="Sparkline"
      margin={{left: 1, right: 1, top: 1, bottom: 1}}
      {...props}
    >
      <YAxis tickTotal={0}/>
      <LineSeries data={data} color={color}/>
    </XYPlot>
  );
}
