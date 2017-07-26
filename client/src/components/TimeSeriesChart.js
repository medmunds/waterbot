import moment from 'moment';
import React from 'react';
import {VictoryAxis, VictoryBar, VictoryChart, VictoryGroup} from 'victory';


export default function TimeSeriesChart({
  data,
  timeField, timeFormat, timeTickFormat,
  valueField,
  start, end,
  theme,
}) {
  data = data || [];
  start = moment(start);
  end = moment(end);

  const cleanedData = data
    .map(d => ({
      x: moment(d[timeField], timeFormat),
      y: typeof valueField === "function" ? valueField(d) : d[valueField],
      width: 5, // ugh -- surely there's a better way to control bar spacing
    }))
    .filter(({x}) => (start <= x && x < end));
  const maxY = Math.max.apply(null, cleanedData.map(({y}) => y));
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
          data={cleanedData}
        />
      </VictoryGroup>
    </VictoryChart>
  );
}

