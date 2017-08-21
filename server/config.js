
exports.projectId = "molten-turbine-171801";
exports.datasetId = "meter";
exports.tableId = "readings";

exports.defaultTimezone = "US/Pacific";

exports.CUFT_PER_METER_TICK = 0.1; // meter ticks are 1/10 cubic foot
exports.CUFT_DECIMAL_PLACES = 7; // for rounding historic readings (where cuft was computed from gallons)
