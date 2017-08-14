import React from 'react';
import {VictoryLine} from 'victory';
import defaultTheme from './victoryTheme';


export default function Sparkline({
  data,
  theme=defaultTheme,
  width=120,
  height=24,
  ...props
}) {
  const wrapperProps = {
    width,
    height,
    style: {
      borderLeft: "1px solid #E0E0E0",
      boxSizing: "border-box",
    },
  };
  const lineProps = {
    data,
    theme,
    width,
    height,
    domainPadding: 1,
    padding: 0,
    style: {
      data: {
        strokeWidth: 1,
      },
    },
    standalone: false,  // supply our own svg wrapper to avoid odd double-nesting and padding
    ...props
  };

  return <svg {...wrapperProps}><VictoryLine {...lineProps}/></svg>;
}
