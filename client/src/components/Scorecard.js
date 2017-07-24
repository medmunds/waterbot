import React from 'react';
import './Scorecard.css';


export default function Scorecard({
  value,
  unitLabel,
  comparisonValue,
  comparisonLabel,
  fractionDigits=0,
}) {
  const formatter = new Intl.NumberFormat(undefined, {maximumFractionDigits: fractionDigits});

  return (
    <div className="scorecard">
      <span className="scorecard--value">{formatter.format(value)}</span>
      <span className="scorecard--unit">{unitLabel}</span>
    </div>
  );
}
