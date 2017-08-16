import find from 'lodash/find';
import max from 'lodash/max';
import React, {PureComponent} from 'react';
import {
  XYPlot, VerticalBarSeries, LineSeries, XAxis, YAxis, HorizontalGridLines,
  DiscreteColorLegend, Crosshair,
} from 'react-vis';

import 'react-vis/dist/style.css';
import './Chart.css';


const seriesComponents = {
  bar: VerticalBarSeries,
  step: LineSeries,
};

function seriesComponent({data, valueKey, type, ...props}) {
  // Function returning a component -- not a composable component
  // (because react-vis looks for components inheriting from its AbstractSeries as direct children of XYPlot)
  const component = seriesComponents[type];
  return React.createElement(component, {
    key: valueKey,
    data: data.map(row => ({x: row.x, y: row[valueKey]})),
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
    } = this.props;
    let {showLegend} = this.props;

    if (showLegend === undefined) {
      showLegend = series.length > 1;
    }

    const yMax = max(data.map(row => max(series.map(({valueKey}) => row[valueKey])))) || 0;
    const yDomain = [0, Math.max(yMax, 20)];  // ensure reasonable y even with missing data

    return (
      <XYPlot
        className="Chart"
        width={width} height={height}
        xType={xType}
        yDomain={yDomain}
        onMouseLeave={this._onMouseLeave}
      >
        <XAxis
          tickFormat={xTickFormat}
          tickSize={0}
        />
        <YAxis
          tickFormat={yTickFormat}
          tickTotal={yTickCount}
          tickSize={0}
        />
        <HorizontalGridLines tickTotal={yTickCount}/>
        {series.map((s, i) => seriesComponent({
          data,
          ...s,
          onNearestX: i === 0 ? this._onNearestX : undefined,
        }))}
        {showLegend
          ? <div className="Chart--legend"><DiscreteColorLegend
            items={series.map(({label, color, opacity}) => ({title: label, color, opacity}))}
          /></div>
          : null
        }
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
