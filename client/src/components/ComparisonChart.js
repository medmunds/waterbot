import React from 'react';
import {VictoryAxis, VictoryBar, VictoryChart, VictoryGroup, VictoryTooltip} from 'victory';


export default function ComparisonChart({
  series,
  xTickFormat,
  start, end,
  theme,
}) {
  const domain = {
    x: [start, end],
    // y: [0, maxY || 20],  // force a scale if there's no data in range (or all data points are 0)
  };

  return (
    <VictoryChart
      domain={domain}
      domainPadding={20}
      scale={{x: "linear", y: "linear"}}
      theme={theme}
    >
      <VictoryAxis
        tickFormat={xTickFormat}
      />
      <VictoryAxis
        dependentAxis={true}
      />
      <VictoryGroup
        offset={30}
        labels={(d) => `${xTickFormat(d.x)}\n${d.y}` /* this only gets value from last series */}
        labelComponent={<VictoryTooltip/>}
      >
        {series.map(({label, data}) => (
          <VictoryBar
            key={label}
            data={data}
          />
        ))}
      </VictoryGroup>
    </VictoryChart>
  );
}
