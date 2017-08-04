import moment from 'moment';
import React from 'react';
import {VictoryAxis, VictoryBar, VictoryChart, VictoryTooltip} from 'victory';


export default function TimeSeriesChart({
  data,
  timeTickFormat,
  start, end,
  theme,
}) {
  data = data || [];
  start = moment(start);
  end = moment(end);

  const maxY = Math.max.apply(null, data.map(({y}) => y));
  const domain = {
    x: [start, end],
    y: [0, maxY || 20],  // force a scale if there's no data in range (or all data points are 0)
  };

  return (
    <VictoryChart
      domain={domain}
      domainPadding={20}
      scale={{x: "time", y: "linear"}}
      theme={theme}
    >
      <VictoryAxis
        crossAxis={false}
        tickFormat={timeTickFormat}
      />
      <VictoryAxis
        crossAxis={false}
        dependentAxis={true}
      />
      <VictoryBar
          data={data}
          labels={(d) => `${timeTickFormat(d.x)}: ${Math.round(d.y)} gals`}
          labelComponent={<VictoryTooltip/>}
        />
    </VictoryChart>
  );
}

