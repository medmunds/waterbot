import React from 'react';


export function DiagonalHash({
  id,
  background="white",
  color="black",
  strokeWidth=1,
  angle=45,
  width=3,
  height=3,
}) {
  return (
    <pattern
      id={id}
      width={width}
      height={height}
      patternTransform={`rotate(${angle} 0 0)`}
      patternUnits="userSpaceOnUse"
    >
      <rect x="0" y="0" width={width} height={height} fill={background}/>
      <rect x="0" y="0" width={strokeWidth} height={height} fill={color}/>
    </pattern>
  );
}
