import React from 'react';
import './Scorecard.css';


const percentFormatter = new Intl.NumberFormat(undefined, {style: "percent", maximumFractionDigits: 0});

export default function Scorecard({
  value,
  unitLabel,
  comparisonValue,
  comparisonLabel,
  fractionDigits=0,
}) {
  const formatter = new Intl.NumberFormat(undefined, {maximumFractionDigits: fractionDigits});
  let comparison = null;
  if (comparisonValue !== undefined) {
    const change = (value / comparisonValue) - 1.0;
    comparison = <div className="scorecard--comparison">{percentFormatter.format(change)} from {comparisonLabel}</div>;
  }

  return (
    <div className="scorecard">
      <span className="scorecard--value">{formatter.format(value)}</span>
      <span className="scorecard--unit">{unitLabel}</span>
      {comparison}
    </div>
  );
}
