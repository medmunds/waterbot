export function offsetRange(range, amount, unit) {
  // offset a twix range (odd that you can't just use add/subtract on the twix)
  return range.start().add(amount, unit)
    .twix(range.end().add(amount, unit), {allDay: range.allDay});
}
