import React from 'react';

import './ErrorMessages.css';


export default function ErrorMessages({
  errors=[],
  className="",
  children,
  ...props,
}) {
  if (!errors || errors.length < 1) {
    return null;
  }

  const classes = `ErrorMessages ${className}`;
  return (
    <div className={classes} {...props}>
      {errors.map((message, i) => <div className="ErrorMessages--message" key={i}>{message}</div>)}
      {children}
    </div>
  );
}
