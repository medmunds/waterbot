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


type TReportType = 'recent' | 'hourly' | 'daily' | 'monthly';


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
    LOGICAL_AND(time_start >= period_start AND time_end <= period_end) AS is_exact,
    ARRAY_AGG(
      -- TODO: if time_end >= period_end, estimate meter_reading at period_end
      IF(time_end < period_end, meter_reading, NULL) IGNORE NULLS
      ORDER BY time_end DESC LIMIT 1)[SAFE_OFFSET(0)] AS meter_reading
  FROM \`${usageTableId}\`
    JOIN periods ON time_end >= period_start AND time_start < period_end
  WHERE
    site_id = @site_id
  GROUP BY period_start, period_end
  ORDER BY period_start
  ;
`;


export const reportDefs: Record<TReportType, TReportDef> = {
  recent: {
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
      start_datetime: bqDateTime(now.startOf('day').minus({days: 1})),
      end_datetime: bqDateTime(now.endOf('day')),
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
      start_datetime: bqDateTime(now.startOf('day').minus({days: 14})),
      end_datetime: bqDateTime(now.endOf('day')),
    }),
    cache_seconds: 5 * 60,
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
      start_date: bqDate(now.startOf('month').minus({months: 12})),
      end_date: bqDate(now.endOf('month')),
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
