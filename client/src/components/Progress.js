import '../theme.css';
import '@material/linear-progress/dist/mdc.linear-progress.css';

import React from 'react';


export function IndeterminateProgress({
  active=true,
  className="",
  ...props
}) {
  const classes = [
    "mdc-linear-progress",
    "mdc-linear-progress--animation-ready",
    "mdc-linear-progress--indeterminate",
    active ? "mdc-linear-progress--open" : "mdc-linear-progress--closed",
    className,
  ].join(" ");
  return (
    <div role="progressbar" className={classes} {...props}>
      <div className="mdc-linear-progress__bar mdc-linear-progress__primary-bar">
        <span className="mdc-linear-progress__bar-inner"/>
      </div>
    </div>
  );
}
