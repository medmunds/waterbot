import './PageTitle.css';

import React from 'react';


export default function PageTitle({className="", children, ...props}) {
  const classes = `PageTitle ${className}`;
  return <h1 className={classes} {...props}>{children}</h1>;
}
