import React from 'react';
import {getDecimalFormatter, getPercentFormatter} from '../utils/formatters'
import {IconArrowDown, IconArrowUp} from './Icon';
import './Scorecard.css';


export function Comparison({
  value, comparisonValue, comparisonLabel,
  decreaseIsPositive=false, neutralChange=0.05,
}) {
  if (comparisonValue === undefined) {
    return null;
  }

  if (comparisonValue === 0) {
    return <div className="Comparison Comparison-type-zero">--</div>;
  }

  const change = (value / comparisonValue) - 1.0;
  const arrow = (change >= 0) ? <IconArrowUp/> : <IconArrowDown/>;
  const absChange = Math.abs(change);
  const type = (absChange <= neutralChange) ? "neutral"
    : (change >= 0) === !decreaseIsPositive ? "positive" : "negative";
  const classes = `Comparison Comparison-type-${type}`;
  const formattedAbsChange = getPercentFormatter(0)(absChange);

  return (
    <div className={classes}>
      <span className="Comparison--value">{arrow}{formattedAbsChange}</span>
      <span className="Comparison--label">{comparisonLabel}</span>
    </div>
  );
}


export default function Scorecard({
  value,
  prefix,
  suffix,
  comparisonValue,
  comparisonLabel,
  fractionDigits=0,
  decreaseIsPositive,
  neutralChange,
  noValueContent="--",
  title,
  children,
}) {
  const formattedValue = value === undefined
    ? noValueContent
    : getDecimalFormatter(fractionDigits)(value);

  const comparisonProps = {
    value, comparisonValue, comparisonLabel, decreaseIsPositive, neutralChange};

  return (
    <div className="Scorecard">
      {title ? <div className="Scorecard--title">{title}</div> : null}
      <div>
        {prefix ? <span className="Scorecard--prefix">{prefix}</span> : null}
        <span className="Scorecard--value">{formattedValue}</span>
        {suffix ? <span className="Scorecard--suffix">{suffix}</span> : null}
      </div>
      <Comparison {...comparisonProps}/>
      {children}
    </div>
  );
}
