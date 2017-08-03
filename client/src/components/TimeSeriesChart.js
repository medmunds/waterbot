import moment from 'moment';
import React from 'react';
import {VictoryAxis, VictoryBar, VictoryChart, VictoryGroup} from 'victory';


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
        tickFormat={timeTickFormat}
      />
      <VictoryAxis
        dependentAxis={true}
      />
      <VictoryGroup>
      <VictoryBar
          data={data}
        />
      </VictoryGroup>
    </VictoryChart>
  );
}

