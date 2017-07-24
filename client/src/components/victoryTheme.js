// Adapted from VictoryTheme.material

import _assign from "lodash/assign";


// *
// * Colors
// *
const blue400 = "#4285F5";
const blue100 = "#BBDEFB";
const blue800 = "#1565C0";
// const yellow200 = "#FFF59D";
// const deepOrange600 = "#F4511E";
// const lime300 = "#DCE775";
// const lightGreen500 = "#8BC34A";
// const teal700 = "#00796B";
// const cyan900 = "#006064";
const colors = [blue400, blue100, blue800];

// const blueGrey50 = "#ECEFF1";
// const blueGrey300 = "#90A4AE";
// const blueGrey700 = "#455A64";
// const grey900 = "#212121";

const grey300 = "#E0E0E0";
const grey700 = "#616161";

const strokeGrid = "rgba(0, 0, 0, 0.12)";
const strokeAxis = "rgba(0, 0, 0, 0.54)";
const fillLabels = strokeAxis;


// *
// * Typography
// *
const sansSerif = "'Roboto', 'Helvetica Neue', Helvetica, sans-serif";
const letterSpacing = "normal";
const fontSize = 14;
// *
// * Layout
// *
const padding = 8;
const baseProps = {
  width: 600,
  height: 300,
  // padding: 50
};
// *
// * Labels
// *
const baseLabelStyles = {
  fontFamily: sansSerif,
  fontSize: fontSize,
  letterSpacing: letterSpacing,
  padding: padding,
  fill: fillLabels,
  stroke: "transparent",
  strokeWidth: 0
};

const centeredLabelStyles = _assign({ textAnchor: "middle" }, baseLabelStyles);
// *
// * Strokes
// *
const strokeLinecap = "round";
const strokeLinejoin = "round";

export default {
  area: _assign({
    style: {
      data: {
        fill: colors[0]
      },
      labels: centeredLabelStyles
    }
  }, baseProps),
  axis: _assign({
    style: {
      axis: {
        fill: "transparent",
        stroke: "transparent",
        strokeWidth: 0,
        strokeLinecap: strokeLinecap,
        strokeLinejoin: strokeLinejoin
      },
      grid: {
        fill: "transparent",
        stroke: "transparent",
        strokeLinecap: strokeLinecap,
        strokeLinejoin: strokeLinejoin,
        strokeWidth: 0,
        pointerEvents: "none"
      },
      ticks: {
        fill: "transparent",
        size: 0,
        stroke: "transparent",
        strokeWidth: 0,
        strokeLinecap: strokeLinecap,
        strokeLinejoin: strokeLinejoin
      },
      axisLabel: _assign({}, centeredLabelStyles, {
        padding: padding,
        stroke: "transparent"
      }),
      tickLabels: _assign({}, baseLabelStyles, {
        fill: fillLabels
      })
    }
  }, baseProps),
  dependentAxis: {
    style: {
      grid: {
        stroke: strokeGrid,
        strokeWidth: 1,
      },
    },
  },
  independentAxis: {
    style: {
      axis: {
        stroke: strokeAxis,
        strokeWidth: 1,
      },
      ticks: {
        size: 5,
        stroke: strokeAxis,
        strokeWidth: 1,
      },
    },
  },
  bar: _assign({
    style: {
      data: {
        fill: colors[0],
        padding: padding,
        strokeWidth: 0
      },
      labels: baseLabelStyles
    }
  }, baseProps),
  candlestick: _assign({
    style: {
      data: {
        stroke: colors[0]
      },
      labels: centeredLabelStyles
    },
    candleColors: {
      positive: "#ffffff",
      negative: colors[0]
    }
  }, baseProps),
  chart: baseProps,
  errorbar: _assign({
    style: {
      data: {
        fill: "transparent",
        opacity: 1,
        stroke: grey700,
        strokeWidth: 2
      },
      labels: centeredLabelStyles
    }
  }, baseProps),
  group: _assign({
    colorScale: colors
  }, baseProps),
  line: _assign({
    style: {
      data: {
        fill: "transparent",
        opacity: 1,
        stroke: colors[0],
        strokeWidth: 2
      },
      labels: centeredLabelStyles
    }
  }, baseProps),
  pie: _assign({
    colorScale: colors,
    style: {
      data: {
        padding: padding,
        stroke: grey300,
        strokeWidth: 1
      },
      labels: _assign({}, baseLabelStyles, { padding: 20 })
    }
  }, baseProps),
  scatter: _assign({
    style: {
      data: {
        fill: colors[0],
        opacity: 1,
        stroke: "transparent",
        strokeWidth: 0
      },
      labels: centeredLabelStyles
    }
  }, baseProps),
  stack: _assign({
    colorScale: colors
  }, baseProps),
  tooltip: {
    style: _assign({}, centeredLabelStyles, { padding: 5, pointerEvents: "none" }),
    flyoutStyle: {
      stroke: strokeAxis,
      strokeWidth: 1,
      fill: "#f0f0f0",
      pointerEvents: "none"
    },
    cornerRadius: 5,
    pointerLength: 10
  },
  voronoi: _assign({
    style: {
      data: {
        fill: "transparent",
        stroke: "transparent",
        strokeWidth: 0
      },
      labels: _assign({}, centeredLabelStyles, { padding: 5, pointerEvents: "none" }),
      flyout: {
        stroke: strokeAxis,
        strokeWidth: 1,
        fill: "#f0f0f0",
        pointerEvents: "none"
      }
    }
  }, baseProps),
  legend: {
    colorScale: colors,
    style: {
      data: {
        type: "circle"
      },
      labels: baseLabelStyles
    }
  }
};
