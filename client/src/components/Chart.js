import './Chart.css';

import find from 'lodash/find';
import max from 'lodash/max';
import React, {PureComponent} from 'react';

import {FlexibleXYPlot} from "react-vis/es/make-vis-flexible";
import Crosshair from "react-vis/es/plot/crosshair";
import CustomSVGSeries from "react-vis/es/plot/series/custom-svg-series";
import DiscreteColorLegend from "react-vis/es/legends/discrete-color-legend";
import HorizontalGridLines from "react-vis/es/plot/horizontal-grid-lines";
import LineSeries from "react-vis/es/plot/series/line-series";
import VerticalBarSeries from "react-vis/es/plot/series/vertical-bar-series";
import VerticalGridLines from "react-vis/es/plot/vertical-grid-lines";
import XAxis from "react-vis/es/plot/axis/x-axis";
import YAxis from "react-vis/es/plot/axis/y-axis";
// import {
//   FlexibleWidthXYPlot,
//   VerticalBarSeries, LineSeries, CustomSVGSeries,
//   XAxis, YAxis, HorizontalGridLines, VerticalGridLines,
//   DiscreteColorLegend, Crosshair,
// } from 'react-vis';

import {chartColors} from '../theme';
import {getDecimalFormatter} from '../utils/formatters';


const seriesComponents = {
  bar: {component: VerticalBarSeries},
  line: {component: LineSeries},
  hash: {component: CustomSVGSeries, cleaner: hashDataCleaner},
};

function standardDataCleaner({data, valueKey}) {
  // filter rows without valueKey?
  return data
    .filter(row => row && row.hasOwnProperty(valueKey))  // react-vis series really hate missing values
    .map(row => ({x: row.x, y: row[valueKey]}));
}

function hashDataCleaner(options) {
  // can't pass this constant customComponent as a CustomSVGSeries prop,
  // because CustomSVGSeries getInnerComponent is broken;
  // workaround is to pass customComponent with every data point
  const {color, fill, stroke} = options;
  const hash = () => <rect x="-12" y="-1" width="24" height="2" stroke={stroke || color} fill={fill || color}/>;
  return standardDataCleaner(options)
    .map(row => ({
      customComponent: hash,
      ...row
    }));
}


function Defs({children}) {
  // deliberately ignore other props, because react-vis sets a bunch of them that don't apply
  return (
    <defs>
      {children}
    </defs>
  );
}
Defs.requiresSVG = true; // tells react-vis to put Plot child in in svg
// (https://github.com/uber/react-vis/issues/402#issuecomment-298749338)


function seriesComponent({data, valueKey, type, color=chartColors.primary, ...props}) {
  // Function returning a component -- not a composable component
  // (because react-vis looks for components inheriting from its AbstractSeries as direct children of XYPlot)
  const {component, props: componentProps, cleaner=standardDataCleaner} = seriesComponents[type];
  return React.createElement(component, {
    ...componentProps,
    key: valueKey,
    data: cleaner({data, valueKey, type, color, ...props}),
    color,
    ...props
  });
}

const formatNumber = getDecimalFormatter(0);

export default class Chart extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      tooltipDatum: undefined,
    };

    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onNearestX = this._onNearestX.bind(this);
  }

  static defaultProps = {
    xType: "ordinal",
    xTickFormat: formatNumber,
    yTickFormat: formatNumber,
    yTickCount: 4,
    ySkipZero: true,
    margin: {left: 50, right: 1, top: 10, bottom: 40},
    className: "",
  };

  render() {
    const {
      data,
      series,
      xType,
      xDomain,
      xTickFormat,
      xMinorTickValues,
      xMajorTickValues,
      xGridValues,
      yTickFormat,
      yTickCount,
      ySkipZero,
      className,
      margin,
      defs,
      children,
    } = this.props;

    const yMax = max(data.map(row => max(series.map(({valueKey}) => row[valueKey])))) || 0;
    const yDomain = [0, Math.max(yMax, 5)];  // ensure reasonable y even with missing data
    const yFormat = ySkipZero ? (y) => (y === 0 ? undefined : yTickFormat(y)) : yTickFormat;

    const xTickSize = xMinorTickValues ? 5 : 0;
    const xMajorTickFormat = xMajorTickValues
      ? (x) => (find(xMajorTickValues, x) ? xTickFormat(x) : undefined)
      : xTickFormat;

    // react-vis tickValues must be string or number
    const xMinorTickValuesNumbers = xMinorTickValues
      ? xMinorTickValues.map(v => +v) : xMinorTickValues;
    const xGridValuesNumbers = xGridValues
      ? xGridValues.map(v => +v) : xGridValues;

    const legendItems = this._getLegendItems();
    const adjustedMargin = legendItems ? {...margin, bottom: margin.bottom + 20} : margin;
    const classes = `Chart ${className}`;

    return (
      <FlexibleXYPlot
        className={classes}
        margin={adjustedMargin}
        xType={xType}
        xDomain={xDomain}
        yDomain={yDomain}
        onMouseLeave={this._onMouseLeave}
      >
        {defs ? <Defs>{defs}</Defs> : null}
        <HorizontalGridLines tickTotal={yTickCount}/>
        {xGridValues ? <VerticalGridLines tickValues={xGridValuesNumbers}/> : null}
        {series.map((s, i) => seriesComponent({
          data,
          ...s,
          onNearestX: i === 0 ? this._onNearestX : undefined,
        }))}
        <XAxis
          tickFormat={xMajorTickFormat}
          tickSizeInner={0}
          tickSizeOuter={xTickSize}
          tickValues={xMinorTickValuesNumbers}
        />
        <YAxis
          style={{line: {stroke: "none"}}}
          tickFormat={yFormat}
          tickTotal={yTickCount}
          tickSize={0}
        />
        {children}
        {this._renderLegend(legendItems)}
        {this._renderTooltip()}
      </FlexibleXYPlot>
    );
  }

  _onNearestX(value) {
    const tooltipDatum = find(this.props.data, {x: value.x});
    this.setState({tooltipDatum});
  }

  _onMouseLeave() {
    this.setState({tooltipDatum: undefined});
  }

  _getLegendItems() {
    const {showLegend, series} = this.props;
    const legendSeries = series.filter(s => !s.hideLegend);
    // default is to show legend if there's more than one series
    if (showLegend || (showLegend === undefined && legendSeries.length > 1)) {
      return legendSeries.map(
            ({label, legendLabel, color=chartColors.primary, opacity}) =>
              ({title: legendLabel || label, color, opacity}));
    } else {
      return undefined;
    }
  }

  _renderLegend(legendItems) {
    if (legendItems) {
      return (
        <DiscreteColorLegend
          orientation="horizontal"
          items={legendItems}
        />
      );
    }
  }

  _renderTooltip() {
    const {tooltipDatum} = this.state;

    if (tooltipDatum) {
      const {series, xTickFormat, xTooltipFormat, yTickFormat, yTooltipFormat} = this.props;
      const xFormat = xTooltipFormat || xTickFormat;
      const yFormat = yTooltipFormat || yTickFormat;
      const datum = tooltipDatum;

      return (
        <Crosshair values={[datum] /* only datum.x matters */}>
          <table className="Chart--tooltip">
            <tbody>
              <tr><th colSpan="2">{xFormat(datum.x)}</th></tr>
              {series
                .filter(({hideTooltip, valueKey}) => !hideTooltip && datum.hasOwnProperty(valueKey))
                .map(({label, tooltipLabel, valueKey}) =>
                  <tr key={valueKey}>
                    <td>{tooltipLabel || label}</td>
                    <td>{yFormat(datum[valueKey])}</td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </Crosshair>
      );
    }
  }

}
