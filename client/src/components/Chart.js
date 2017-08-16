import './Chart.css';

import find from 'lodash/find';
import max from 'lodash/max';
import React, {PureComponent} from 'react';
import {
  XYPlot,
  VerticalBarSeries, LineSeries, CustomSVGSeries,
  XAxis, YAxis, HorizontalGridLines,
  DiscreteColorLegend, Crosshair,
} from 'react-vis';


const seriesComponents = {
  bar: {component: VerticalBarSeries},
  line: {component: LineSeries},
  hash: {component: CustomSVGSeries, cleaner: hashDataCleaner},
};

function standardDataCleaner({data, valueKey}) {
  // filter rows without valueKey?
  return data.map(row => ({x: row.x, y: row[valueKey]}));
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


function seriesComponent({data, valueKey, type, ...props}) {
  // Function returning a component -- not a composable component
  // (because react-vis looks for components inheriting from its AbstractSeries as direct children of XYPlot)
  const {component, props: componentProps, cleaner=standardDataCleaner} = seriesComponents[type];
  return React.createElement(component, {
    ...componentProps,
    key: valueKey,
    data: cleaner({data, valueKey, type, ...props}),
    ...props
  });
}

const formatNumber = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format;
const formatNumberSkipZero = (n) => (n === 0 ? undefined : formatNumber(n));


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
    yTickFormat: formatNumberSkipZero,
    yTickCount: 4,
    yTooltipFormat: formatNumber,
    width: 600,
    height: 300,
    margin: {left: 80, right: 0, top: 10, bottom: 40},
  };

  render() {
    const {
      data,
      series,
      xType,
      xTickFormat,
      yTickFormat,
      yTickCount,
      width,
      height,
      margin,
    } = this.props;

    const yMax = max(data.map(row => max(series.map(({valueKey}) => row[valueKey])))) || 0;
    const yDomain = [0, Math.max(yMax, 20)];  // ensure reasonable y even with missing data

    const xPadding = xType === "ordinal" ? undefined : 10;

    return (
      <XYPlot
        className="Chart"
        width={width} height={height}
        margin={margin}
        xType={xType}
        xPadding={xPadding}
        yDomain={yDomain}
        onMouseLeave={this._onMouseLeave}
      >
        <HorizontalGridLines tickTotal={yTickCount}/>
        {series.map((s, i) => seriesComponent({
          data,
          ...s,
          onNearestX: i === 0 ? this._onNearestX : undefined,
        }))}
        <XAxis
          tickFormat={xTickFormat}
          tickSize={0}
        />
        <YAxis
          style={{line: {stroke: "none"}}}
          tickFormat={yTickFormat}
          tickTotal={yTickCount}
          tickSize={0}
        />
        {this._renderLegend()}
        {this._renderTooltip()}
      </XYPlot>
    );
  }

  _onNearestX(value) {
    const tooltipDatum = find(this.props.data, {x: value.x});
    this.setState({tooltipDatum});
  }

  _onMouseLeave() {
    this.setState({tooltipDatum: undefined});
  }

  _renderLegend() {
    // default is to show legend if there's more than one series
    const {showLegend, series} = this.props;
    const legendSeries = series.filter(s => !s.hideLegend);
    if (showLegend || (showLegend === undefined && legendSeries.length > 1)) {
      return (
        <DiscreteColorLegend
          items={legendSeries.map(
            ({label, legendLabel, color, opacity}) =>
              ({title: legendLabel || label, color, opacity}))}
        />
      )
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
            <tr><th colSpan="2">{xFormat(datum.x)}</th></tr>
            {series
              .filter(({valueKey}) => datum.hasOwnProperty(valueKey))
              .map(({label, tooltipLabel, valueKey}) =>
                <tr key={valueKey}>
                  <td>{tooltipLabel || label}</td>
                  <td>{yFormat(datum[valueKey])}</td>
                </tr>
              )
            }
          </table>
        </Crosshair>
      );
    }
  }

}
