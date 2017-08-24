import React from 'react';

import './Icon.css';


function SvgIcon({
  children,
  className='',
  title,
  width=24,
  height=24,
  ...props
}) {
  const classes = `Icon ${className}`;
  return (
    <svg
      className={classes}
      width={width} height={height}
      viewBox={`0 0 ${width} ${height}`}
      title={title}
      role="img"
      {...props}
    >
      <title>{title}</title>
      {children}
      <path d={`M0 0h${width}v${height}H0z`} fill="none"/>
    </svg>
  );
}


// ArrowUp and ArrowDown are designed to be character width, rather than full icon width
export function IconArrowUp() {
  return (
    <SvgIcon className="IconArrowUp" title="up" width="16">
      <path d="M2 16h12l-6 -10z"/>
    </SvgIcon>
  );
}
export function IconArrowDown() {
  return (
    <SvgIcon className="IconArrowDown" title="down" width="16">
      <path d="M2 6h12l-6 10z"/>
    </SvgIcon>
  );
}
