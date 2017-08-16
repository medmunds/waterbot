import './Section.css';

import React from 'react';


export default function Section({
  className="",
  title,
  buttons,
  chart,
  children,
  ...props
}) {
  const classes = `Section ${className}`;
  return (
    <section className={classes} {...props}>
      <h2 className="Section--heading">
        <span className="Section--title">{title}</span>
        {buttons ? <span className="Section--buttons">{buttons}</span> : null}
      </h2>
      <div className="Section--left">
        {children}
      </div>
      {chart ? <div className="Section--right">{chart}</div> : null}
    </section>
  );
}
