// gcloud functions deploy report --stage-bucket waterbot --trigger-http --runtime nodejs16
// gcloud functions logs read report --limit 50
// https://us-central1-molten-turbine-171801.cloudfunctions.net/report
// noinspection SqlResolve


import type {HttpFunction} from '@google-cloud/functions-framework/build/src/functions';
import {DateTime} from 'luxon';
import {bigquery} from './bigquery';
import {
  datasetId,
  defaultTimezone,
  projectId,
  usageTableId,
  REPORTING_DECIMAL_PLACES,
} from './config';


type TReportType = 'minutely' | 'hourly' | 'daily' | 'monthly' | 'device';


interface TReportDef {
  query: string;
  params: (now: DateTime) => Record<string, string>;
  cache_seconds: number;
}


// Convert Luxon DateTime to BigQuery compatible DATETIME or DATE literals
const bqDateTime = (dt: DateTime) => dt.toFormat("yyyy-MM-dd HH:mm:ss");
const bqDate = (dt: DateTime) => dt.toFormat("yyyy-MM-dd"); // or dt.toISODate()


/**
 * Construct a query that reports usage per period.
 * The resulting query requires parameters:
 *   label_format
 *   timezone
 *   usage_decimal_places
 *   site_id
 * plus any parameters needed for the periodsGenerator.
 *
 * @param periodsGenerator a subquery that generates a table
 *   with columns `period_start` and `period_end` which are the
 *   timestamps of the start (inclusive) and end (exclusive)
 *   of each period in the report.
 */
const usageReportQuery = (periodsGenerator: string) => `
  WITH periods AS (${periodsGenerator})
  SELECT
    FORMAT_TIMESTAMP(@label_format, period_start, @timezone) AS label,
    period_start,
    period_end,
    ROUND(
      SUM(usage_liters * IF(
        0 = TIMESTAMP_DIFF(time_end, time_start, SECOND),
        1,
        TIMESTAMP_DIFF(
          LEAST(time_end, period_end),
          GREATEST(time_start, period_start), SECOND)
        / TIMESTAMP_DIFF(time_end, time_start, SECOND))),
      @usage_decimal_places) AS usage_liters,
    LOGICAL_AND(time_start >= period_start AND time_end <= period_end) AS usage_exact,
    ARRAY_AGG(
      CASE
        WHEN time_end < period_end THEN meter_reading
        WHEN TIMESTAMP_DIFF(time_end, time_start, SECOND) > 0 THEN
          -- Estimate at period_end, rounding to whole meter units
          CAST(meter_reading - usage_meter_units * SAFE_DIVIDE(
            TIMESTAMP_DIFF(time_end, period_end, SECOND),
            TIMESTAMP_DIFF(time_end, time_start, SECOND)) AS INTEGER)
      END IGNORE NULLS
      ORDER BY time_end DESC LIMIT 1)[SAFE_OFFSET(0)] AS meter_reading,
    LOGICAL_AND(time_end < period_end OR usage_meter_units IS NULL) AS meter_reading_exact
  FROM \`${usageTableId}\`
    JOIN periods ON time_end >= period_start AND time_start < period_end
  WHERE
    site_id = @site_id
  GROUP BY period_start, period_end
  ORDER BY period_start
  ;
`;


export const reportDefs: Record<TReportType, TReportDef> = {
  minutely: {
    query: usageReportQuery(`
      SELECT
        period_start,
        TIMESTAMP_ADD(period_start, INTERVAL 1 MINUTE) AS period_end
      FROM UNNEST(
        GENERATE_TIMESTAMP_ARRAY(
          TIMESTAMP(@start_datetime, @timezone),
          TIMESTAMP(@end_datetime, @timezone),
          INTERVAL 1 MINUTE)
      ) AS period_start
    `),
    params: (now) => ({
      label_format: '%Y-%m-%d %H:%M:%S%Ez',
      start_datetime: bqDateTime(now.startOf('hour').minus({hours: 24})),
      end_datetime: bqDateTime(now.endOf('hour')),
    }),
    cache_seconds: 5 * 60,
  },
  hourly: {
    query: usageReportQuery(`
      SELECT
        period_start,
        TIMESTAMP_ADD(period_start, INTERVAL 1 HOUR) AS period_end
      FROM UNNEST(
        GENERATE_TIMESTAMP_ARRAY(
          TIMESTAMP(@start_datetime, @timezone),
          TIMESTAMP(@end_datetime, @timezone),
          INTERVAL 1 HOUR)
      ) AS period_start
    `),
    params: (now) => ({
      label_format: '%Y-%m-%d %H:%M:%S%Ez',
      start_datetime: bqDateTime(now.startOf('day').minus({days: 7})),
      end_datetime: bqDateTime(now.endOf('day')),
    }),
    cache_seconds: 3 * 60 * 60,
  },
  daily: {
    query: usageReportQuery(`
      SELECT
        TIMESTAMP(date_start, @timezone) AS period_start,
        TIMESTAMP(DATE_ADD(date_start, INTERVAL 1 DAY), @timezone) AS period_end,
      FROM UNNEST(
        GENERATE_DATE_ARRAY(@start_date, @end_date, INTERVAL 1 DAY)
      ) AS date_start
    `),
    params: (now) => ({
      label_format: '%Y-%m-%d',
      start_date: bqDate(now.startOf('year').minus({years: 1})),
      end_date: bqDate(now.endOf('year')),
    }),
    cache_seconds: 12 * 60 * 60,
  },
  monthly: {
    query: usageReportQuery(`
      SELECT
        TIMESTAMP(date_start, @timezone) AS period_start,
        TIMESTAMP(DATE_ADD(date_start, INTERVAL 1 MONTH), @timezone) AS period_end,
      FROM UNNEST(
        GENERATE_DATE_ARRAY(@start_date, @end_date, INTERVAL 1 MONTH)
      ) AS date_start
    `),
    params: (now) => ({
      label_format: '%Y-%m',
      start_date: bqDate(now.startOf('year').minus({years: 3})),
      end_date: bqDate(now.endOf('year')),
    }),
    cache_seconds: 24 * 60 * 60,
  },
  device: {
    query: `
      SELECT
        FORMAT_TIMESTAMP(@label_format, time_generated, @timezone) AS label,
        meter_reading,
        -- battery:
        battery_v,
        battery_pct,
        -- wifi:
        wifi_strength_pct,
        wifi_quality_pct,
        wifi_signal_dbm,
        wifi_snr_db,
        -- message delivery:
        TIMESTAMP_DIFF(time_sent, time_generated, SECOND) AS publish_sec,
        TIMESTAMP_DIFF(time_received, time_sent, SECOND) AS delivery_sec,
        network_retry_count,
        -- other:
        time_generated,
        sequence,
        firmware_version
      FROM \`molten-turbine-171801\`.waterbot.device_data
      WHERE
        site_id = @site_id
        AND time_generated >= TIMESTAMP(@start_datetime, @timezone)
        AND time_generated < TIMESTAMP(@end_datetime, @timezone)
      ORDER BY time_generated, sequence
      ;
    `,
    params: (now) => ({
      label_format: '%Y-%m-%d %H:%M:%S%Ez',
      start_datetime: bqDateTime(now.startOf('hour').minus({hours: 24})),
      end_datetime: bqDateTime(now.endOf('hour')),
    }),
    cache_seconds: 5 * 60,
  }
};


export const report: HttpFunction = async (req, res) => {
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
    res.status(422).json({error: `Unknown 'type'`}).end();
    return;
  }

  const timezone = defaultTimezone;
  const site_id = Array.isArray(req.query.site_id) ? req.query.site_id[0] : req.query.site_id;
  if (!site_id) {
    res.status(422).json({error: `Param 'site_id' is required`}).end();
    return;
  }

  const {query, params} = report;
  const now = DateTime.now().setZone(timezone);
  const queryOptions = {
    query,
    params: {
      site_id,
      timezone,
      usage_decimal_places: REPORTING_DECIMAL_PLACES,
      ...params(now),
    },
    useLegacySql: false,
    defaultDataset: {
      projectId,
      datasetId,
    },
  };

  try {
    console.log(`Starting ${type} query:`, queryOptions);
    const [rows] = await bigquery.query(queryOptions);
    console.log(`Query ${type} complete: ${rows.length} rows`);
    const result = {
      data: rows,
      generated_at: now.toISO({suppressMilliseconds: true}),
      timestamp: +now.toJSDate(),
      // would be nice if we could determine whether BigQuery result was cached
    };
    res.set('Cache-Control', `public, max-age=${report.cache_seconds}`);
    res.json(result);
    res.end();
  } catch (err) {
    console.error('ERROR:', err);
    if (!res.headersSent) {
      res.status(400);
    }
    res.json({error: `${err}`});
    res.end();
  }
}
