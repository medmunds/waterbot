import React from 'react';
import './Scorecard.css';


const percentFormatter = new Intl.NumberFormat(undefined, {style: "percent", maximumFractionDigits: 0});

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
  const arrow = (change >= 0) ? "▲" : "▼";
  const absChange = Math.abs(change);
  const type = (absChange <= neutralChange) ? "neutral"
    : (change >= 0) === !decreaseIsPositive ? "positive" : "negative";
  const classes = `Comparison Comparison-type-${type}`;

  return (
    <div className={classes}>
      <span className="Comparison--value">{arrow}{percentFormatter.format(absChange)}</span>
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
  title,
  children,
}) {
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  const comparisonProps = {
    value, comparisonValue, comparisonLabel, decreaseIsPositive, neutralChange};

  return (
    <div className="Scorecard">
      {title ? <div className="Scorecard--title">{title}</div> : null}
      <div>
        {prefix ? <span className="Scorecard--prefix">{prefix}</span> : null}
        <span className="Scorecard--value">{formatter.format(value)}</span>
        {suffix ? <span className="Scorecard--suffix">{suffix}</span> : null}
      </div>
      <Comparison {...comparisonProps}/>
      {children}
    </div>
  );
}
