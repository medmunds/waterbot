import React from 'react';

import './PageFooter.css';


export default function PageFooter({
  children,
  className='',
  ...props
}) {
  const classes = `PageFooter ${className}`;
  return (
    <footer className={classes} {...props}>
      {children}
    </footer>
  )
}
