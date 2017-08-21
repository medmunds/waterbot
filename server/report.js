// gcloud beta functions deploy report --stage-bucket waterbot --trigger-http
// https://us-central1-molten-turbine-171801.cloudfunctions.net/report


const BigQuery = require('@google-cloud/bigquery');
const moment = require('moment');

const {
  projectId,
  datasetId,
  tableId,
  defaultTimezone,
} = require('./config');

const bigquery = BigQuery({
    projectId: projectId
});


const reports = {
  recent: {
    query: `
      #standardSQL
      SELECT
        ROUND(usage_cuft, 1) AS usage_cuft,
        ROUND(current_reading_cuft, 1) AS current_reading_cuft,
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S%Ez', timestamp, @timezone) AS \`time\`,
        period_sec,
        ROUND(battery_pct, 2) AS battery_pct,
        ROUND(battery_v, 1) AS battery_v,
        wifi_signal
      FROM \`${tableId}\`
      WHERE
        timestamp >= @start_timestamp
        AND device_id = @device_id
      ORDER BY timestamp ASC
      ;`,
    start_time: (now) => moment(now).startOf('day').subtract(14, 'days'),
    cache_seconds: 5 * 60,
  },
  hourly: {
    query: `
      #standardSQL
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d %H%Ez', timestamp, @timezone) AS \`hour\`,
        ROUND(SUM(usage_cuft), 1) AS usage_cuft,
        COUNT(*) AS num_readings,
        ROUND(MAX(current_reading_cuft), 1) AS last_reading_cuft,
        UNIX_SECONDS(MAX(timestamp)) AS last_reading_timestamp,
        ROUND(MIN(battery_pct), 2) AS min_battery_pct,
        ROUND(MIN(battery_v), 1) AS min_battery_v,
        ROUND(AVG(wifi_signal), 1) AS avg_wifi_signal
      FROM \`${tableId}\`
      WHERE
        timestamp >= @start_timestamp
        AND device_id = @device_id
      GROUP BY \`hour\`
      ORDER BY \`hour\` ASC
      ;`,
    start_time: (now) => moment(now).startOf('day').subtract(14, 'days'),
    cache_seconds: 5 * 60,
  },
  daily: {
    query: `
      #standardSQL
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d', timestamp, @timezone) AS \`date\`,
        ROUND(SUM(usage_cuft), 1) AS usage_cuft,
        COUNT(*) AS num_readings,
        ROUND(MAX(current_reading_cuft), 1) AS last_reading_cuft
      FROM \`${tableId}\`
      WHERE
        timestamp >= @start_timestamp
        AND device_id = @device_id
      GROUP BY \`date\`
      ORDER BY \`date\` ASC
      ;`,
    start_time: (now) => moment(now).startOf('year').subtract(12, 'months'),
    cache_seconds: 12 * 60 * 60,
  },
  monthly: {
    query: `
      #standardSQL
      SELECT
        FORMAT_TIMESTAMP('%Y-%m', timestamp, @timezone) AS \`month\`,
        ROUND(SUM(usage_cuft), 1) AS usage_cuft,
        COUNT(*) AS num_readings,
        ROUND(MAX(current_reading_cuft), 1) AS last_reading_cuft
      FROM \`${tableId}\`
      WHERE
        timestamp >= @start_timestamp
        AND device_id = @device_id
      GROUP BY \`month\`
      ORDER BY \`month\` ASC
      ;`,
    start_time: (now) => moment(now).startOf('year').subtract(3, 'years'),
    cache_seconds: 24 * 60 * 60,
  },
};


exports.report = function report(req, res) {
  // TODO: validate req.method
  res.set('Access-Control-Allow-Origin', '*');

  const type = (req.query.type || 'daily').toLowerCase();
  const report = reports[type];
  if (!report) {
    res.status(400).json({error: `Unknown 'type'`}).end();
    return;
  }

  const timezone = req.query.timezone || defaultTimezone;
  const device_id = req.query.device_id;
  if (!device_id) {
    res.status(400).json({error: `Param 'device_id' is required`}).end();
    return;
  }

  const query = report.query;
  const start_time = report.start_time();
  const start_timestamp = bigquery.timestamp(start_time);

  const queryOptions = {
      query,
      params: {
        device_id,
        start_timestamp,
        timezone,
      },
      useLegacySql: false,
      defaultDataset: {
        projectId,
        datasetId,
      },
    };

  console.log(`Starting ${type} query:`, queryOptions);
  bigquery
    .query(queryOptions)
    .then(function queryComplete(results) {
      const rows = results[0];
      console.log(`Query ${type} complete: ${rows.length} rows`);
      const result = {
        data: rows,
        // would be nice if we could determine whether BigQuery result was cached
      };
      res.set('Cache-Control', `public, max-age=${report.cache_seconds}`);
      res.json(result);
      res.end();
    })
    .catch((err) => {
      console.error('ERROR:', err);
      if (!res.headersSent) {
        res.status(400);
      }
      res.send(err);
      res.end();
    });
};
