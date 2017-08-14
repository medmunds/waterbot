import React from 'react';
import {
  VictoryAxis, VictoryBar, VictoryChart, VictoryGroup,
  VictoryLegend, VictoryTooltip, VictoryVoronoiContainer,
} from 'victory';


export default function ComparisonChart({
  data,
  series,
  xTickFormat,
  start, end,
  theme,
}) {
  const domain = {
    x: [start, end],
    // y: [0, maxY || 20],  // force a scale if there's no data in range (or all data points are 0)
  };

  function formatValue(y) {
    // make me a prop (share value formatters with scorecards, maybe y axis)
    return y === undefined ? '--' : y.toFixed();
  }

  function tooltip(d) {
    const values = series.map(
      ({label, valueKey}) => `${label}: ${formatValue(d[valueKey])}`);
    return `${xTickFormat(d.x)}\n${values.join('\n')}`
  }

  const legendProps = {
    data: series.map(({label}) => ({
      name: label,
    })),
    theme: theme,
    standalone: false,
    width: 80,
    height: series.length*18 + 2*8,
    padding: 8,
  };

  return (
    <VictoryChart
      containerComponent={
        <VictoryVoronoiContainer
          dimension="x"
          labels={tooltip}
          labelComponent={
            <VictoryTooltip
              cornerRadius={0}
              y={250 /* somehow get height of plot area here */}
            />}
        />}
      domain={domain}
      domainPadding={{x: [20, 20]}}
      scale={{x: "linear", y: "linear"}}
      theme={theme}
    >
      <VictoryAxis
        tickCount={end - start + 1}
        tickFormat={xTickFormat}
      />
      <VictoryAxis
        crossAxis={true}
        dependentAxis={true}
        tickCount={4}
      />
      <VictoryGroup
        offset={10}
      >
        {series.map(({label, valueKey}) => (
          <VictoryBar
            key={label}
            data={data}
            y={d => d[valueKey] || 0 /* undefined breaks chart, so force to number */}
          />
        ))}
      </VictoryGroup>
      <g transform="translate(450, 24)">
        <rect width={legendProps.width} height={legendProps.height} fill="#ffffff" stroke="#E0E0E0"/>
        <VictoryLegend {...legendProps}/>
      </g>
    </VictoryChart>
  );
}
