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

  const domain = {
    x: [start, end],
    y: data.length > 0 ? undefined : [0, 100],  // force a scale if there's no data in range
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

