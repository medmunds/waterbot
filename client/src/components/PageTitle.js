import './PageTitle.css';

import React from 'react';


export default function PageTitle({
  children,
  className="",
  title,
  subtitle,
  supertitle,
  ...props
}) {
  const classes = `PageTitle ${className}`;
  return (
    <header className={classes} {...props}>
      <h1>
        {supertitle ? <span className="PageTitle--subtitle">{supertitle}</span> : null}
        <span className="PageTitle--title">{title}</span>
        {subtitle ? <span className="PageTitle--subtitle">{subtitle}</span> : null}
      </h1>
      {children}
    </header>
  );
}
