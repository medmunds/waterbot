import {format} from 'd3-format';


let cachedFormatters = {
  decimal: {},
  percent: {},
};

function getFormatter(style, fractionDigits) {
  // this assumes that we're always using the default locale,
  let formatter = cachedFormatters[style][fractionDigits];
  if (!formatter) {
    const type = {decimal: 'f', percent: '%'}[style];
    formatter = format(`,.${fractionDigits}${type}`); // ',': group thousands; '.N': decimal digits; 'f' or '%'
    cachedFormatters[style][fractionDigits] = formatter;
  }
  return formatter;
}


export function getDecimalFormatter(fractionDigits=0) {
  return getFormatter("decimal", fractionDigits);
}

export function getPercentFormatter(fractionDigits=0) {
  return getFormatter("percent", fractionDigits);
}
