// global Intl.NumberFormat


let cachedFormatters = {
  decimal: {},
  percent: {},
};


function getFormatter(style, fractionDigits) {
  // this assumes that we're always using the default locale,
  let formatter = cachedFormatters[style][fractionDigits];
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    cachedFormatters[style][fractionDigits] = formatter;
  }
  return formatter.format;
}



export function getDecimalFormatter(fractionDigits=0) {
  return getFormatter("decimal", fractionDigits);
}

export function getPercentFormatter(fractionDigits=0) {
  return getFormatter("percent", fractionDigits);
}
