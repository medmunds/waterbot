// gcloud functions deploy report --stage-bucket waterbot --trigger-http --runtime nodejs14
// gcloud functions logs read report --limit 50
// https://us-central1-molten-turbine-171801.cloudfunctions.net/report


import type {HttpFunction} from '@google-cloud/functions-framework/build/src/functions';
import {DateTime} from 'luxon';
import {bigquery} from './bigquery';
import {CUFT_DECIMAL_PLACES, datasetId, defaultTimezone, projectId, tableId} from './config';


type TReportType = 'recent' | 'hourly' | 'daily' | 'monthly';


interface TReportDef {
  query: string;
  start_time: (now?: DateTime) => DateTime;
  cache_seconds: number;
}


export const reportDefs: Record<TReportType, TReportDef> = {
  recent: {
    query: `
      #standardSQL
      SELECT
        ROUND(usage_cuft, @cuft_decimal_places) AS usage_cuft,
        ROUND(current_reading_cuft, @cuft_decimal_places) AS current_reading_cuft,
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
    start_time: (now) => (now ?? DateTime.now()).startOf('day').minus({days: 14}),
    cache_seconds: 5 * 60,
  },
  hourly: {
    query: `
      #standardSQL
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d %H%Ez', timestamp, @timezone) AS \`hour\`,
        ROUND(SUM(usage_cuft), @cuft_decimal_places) AS usage_cuft,
        COUNT(*) AS num_readings,
        ROUND(MAX(current_reading_cuft), @cuft_decimal_places) AS last_reading_cuft,
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S%Ez', MAX(timestamp), @timezone) AS last_reading_time,
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
    start_time: (now) => (now ?? DateTime.now()).startOf('day').minus({days: 14}),
    cache_seconds: 5 * 60,
  },
  daily: {
    query: `
      #standardSQL
      SELECT
        FORMAT_TIMESTAMP('%Y-%m-%d', timestamp, @timezone) AS \`date\`,
        ROUND(SUM(usage_cuft), @cuft_decimal_places) AS usage_cuft,
        COUNT(*) AS num_readings,
        ROUND(MAX(current_reading_cuft), @cuft_decimal_places) AS last_reading_cuft
      FROM \`${tableId}\`
      WHERE
        timestamp >= @start_timestamp
        AND device_id = @device_id
      GROUP BY \`date\`
      ORDER BY \`date\` ASC
      ;`,
    start_time: (now) => (now ?? DateTime.now()).startOf('year').minus({months: 12}),
    cache_seconds: 12 * 60 * 60,
  },
  monthly: {
    query: `
      #standardSQL
      SELECT
        FORMAT_TIMESTAMP('%Y-%m', timestamp, @timezone) AS \`month\`,
        ROUND(SUM(usage_cuft), @cuft_decimal_places) AS usage_cuft,
        COUNT(*) AS num_readings,
        ROUND(MAX(current_reading_cuft), @cuft_decimal_places) AS last_reading_cuft
      FROM \`${tableId}\`
      WHERE
        timestamp >= @start_timestamp
        AND device_id = @device_id
      GROUP BY \`month\`
      ORDER BY \`month\` ASC
      ;`,
    start_time: (now) => (now ?? DateTime.now()).startOf('year').minus({years: 3}),
    cache_seconds: 24 * 60 * 60,
  },
};


export const report: HttpFunction = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.status(405).json({error: `Method not allowed`}).end();
    return;
  }
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const rawType = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
  const type = typeof rawType === 'string' ? rawType.toLowerCase() as TReportType : 'daily';
  const report = reportDefs[type];
  if (!report) {
    res.status(400).json({error: `Unknown 'type'`}).end();
    return;
  }

  const timezone = defaultTimezone;
  const device_id = Array.isArray(req.query.device_id) ? req.query.device_id[0] : req.query.device_id;
  if (!device_id) {
    res.status(400).json({error: `Param 'device_id' is required`}).end();
    return;
  }

  const query = report.query;
  const now = DateTime.now().setZone(timezone);
  const start_time = report.start_time(now);
  const start_timestamp = bigquery.timestamp(start_time.toJSDate());

  const queryOptions = {
    query,
    params: {
      device_id,
      start_timestamp,
      timezone,
      cuft_decimal_places: CUFT_DECIMAL_PLACES,
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
        timestamp: +now.toJSDate(),
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
      res.json({error: err.toString()});
      res.end();
    });
}
