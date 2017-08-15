import max from 'lodash/max';
import React from 'react';
import {
  XYPlot, VerticalBarSeries, LineSeries, XAxis, YAxis, HorizontalGridLines, DiscreteColorLegend,
} from 'react-vis';

import 'react-vis/dist/style.css';
import './Chart.css';


const seriesComponents = {
  bar: VerticalBarSeries,
  step: LineSeries,
};

function seriesComponent(series, data) {
  // Function returning a component -- not a composable component
  // (because react-vis looks for components inheriting from its AbstractSeries as direct children of XYPlot)
  const {valueKey, type, cluster, color, opacity} = series;
  const component = seriesComponents[type];
  const props = {
    key: valueKey,
    data: data.map(row => ({x: row.x, y: row[valueKey]})),
    cluster,
    color,
    opacity,
  };
  return React.createElement(component, props);
}

const formatNumber = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format;
const formatNumberSkipZero = (n) => (n === 0 ? undefined : formatNumber(n));


export default function Chart({
  data,
  series,
  xType="ordinal",
  xTickFormat,
  yTickFormat=formatNumberSkipZero,
  yTickCount=4,
  showLegend,
  width=600,
  height=300,
}) {
  if (data.length < 1) {
    return null;
  }
  if (showLegend === undefined) {
    showLegend = series.length > 1;
  }

  const yMax = max(data.map(row => max(series.map(({valueKey}) => row[valueKey])))) || 0;
  const yDomain = [0, Math.max(yMax, 20)];  // ensure reasonable y even with missing data

  return (
    <XYPlot
      className="Chart"
      width={width} height={height}
      xType={xType}
      yDomain={yDomain}
    >
      <XAxis
        tickFormat={xTickFormat}
        tickSize={0}
      />
      <YAxis
        tickFormat={yTickFormat}
        tickTotal={yTickCount}
        tickSize={0}
      />
      <HorizontalGridLines tickTotal={yTickCount}/>
      {series.map(s => seriesComponent(s, data))}
      {showLegend
        ? <div className="Chart--legend"><DiscreteColorLegend
          items={series.map(({label, color, opacity}) => ({title: label, color, opacity}))}
        /></div>
        : null
      }
    </XYPlot>
  );
}
