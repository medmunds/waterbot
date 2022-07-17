import {Request} from 'jest-express/lib/request';
import {Response} from 'jest-express/lib/response';
import {DateTime} from 'luxon';
import {bigquery} from './bigquery';
import {datasetId, defaultTimezone, projectId, REPORTING_DECIMAL_PLACES} from './config';
import {report, reportDefs} from './report';
import {HttpFunction} from "@google-cloud/functions-framework/build/src/functions";

// Mock Date.now() for consistent "now"
const mockNowString = "2020-02-22T14:23:45.123-08:00";
const mockNowDateTime = DateTime.fromISO(mockNowString, {zone: 'utc'});
const mockNowTimestamp = mockNowDateTime.toMillis();

beforeEach(() => {
  jest.useFakeTimers({now: mockNowDateTime.toMillis()});
});
afterEach(() => {
  jest.useRealTimers();
});


// Mock BigQuery (as used by report function)
jest.mock('./bigquery');
const mockedQuery = jest.fn().mockResolvedValue([[]]);
const mockedBigQuery = jest.mocked(bigquery);
mockedBigQuery.query = mockedQuery;

const doNothing = () => {};


// Emulate an express-style call to fn
async function expressCall(
  fn: HttpFunction,
  request: Request,
): Promise<Response> {
  const response = new Response();
  await new Promise((resolve, reject) => {
    response.end.mockImplementation(resolve);
    // @ts-ignore - jest-express works for our purposes here, though the types are divergent
    fn(request, response);
  });
  return response;
}


test(`recent report`, async () => {
  const data = [{
    period_start: 0,
    label: "2021-04-08 18:37:00-07:00",
    usage_liters: 0,
    is_exact: true,
  }, {
    period_start: 0,
    label: "2021-04-08 18:39:00-07:00",
    usage_liters: 0,
    is_exact: true,
  }];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(doNothing);
  const response = await expressCall(report, new Request("/?site_id=TEST_SITE&type=recent"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=300");
  expect(response.json).toHaveBeenCalledWith({
    data,
    timestamp: mockNowTimestamp,
    generated_at: mockNowString,
  });

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      label_format: "%Y-%m-%d %H:%M:%S%Ez",
      start_datetime: "2020-02-21 00:00:00",
      end_datetime: "2020-02-22 23:59:59",
      site_id: "TEST_SITE",
      timezone: defaultTimezone,
      usage_decimal_places: REPORTING_DECIMAL_PLACES,
    },
    query: reportDefs.recent.query,
    useLegacySql: false,
  });
});

test(`hourly report`, async () => {
  const data = [{
    period_start: 0,
    label: "2021-04-08 18-07:00",
    usage_liters: 0,
    is_exact: true,
  }, {
    period_start: 0,
    label: "2021-04-08 19-07:00",
    usage_liters: 0,
    is_exact: true,
  }];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(doNothing);
  const response = await expressCall(report, new Request("/?site_id=TEST_SITE&type=hourly"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=300");
  expect(response.json).toHaveBeenCalledWith({
    data,
    timestamp: mockNowTimestamp,
    generated_at: mockNowString,
  });

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      label_format: "%Y-%m-%d %H%Ez",
      start_datetime: "2020-02-08 00:00:00",
      end_datetime: "2020-02-22 23:59:59",
      site_id: "TEST_SITE",
      timezone: defaultTimezone,
      usage_decimal_places: REPORTING_DECIMAL_PLACES,
    },
    query: reportDefs.hourly.query,
    useLegacySql: false,
  });
});

test(`daily report`, async () => {
  const data = [
    {period_start: 0, label: "2019-12-31", usage_liters: 0, is_exact: true},
    {period_start: 0, label: "2020-01-02", usage_liters: 0, is_exact: true},
  ];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(doNothing);
  const response = await expressCall(report, new Request("/?site_id=TEST_SITE&type=daily"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=43200");
  expect(response.json).toHaveBeenCalledWith({
    data,
    timestamp: mockNowTimestamp,
    generated_at: mockNowString,
  });

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      label_format: "%Y-%m-%d",
      start_date: "2019-02-01",
      end_date: "2020-02-29",
      site_id: "TEST_SITE",
      timezone: defaultTimezone,
      usage_decimal_places: REPORTING_DECIMAL_PLACES,
    },
    query: reportDefs.daily.query,
    useLegacySql: false,
  });
});

test(`monthly report`, async () => {
  const data = [
    {period_start: 0, label: "2019-12", usage_liters: 11.45, is_exact: true},
    {period_start: 0, label: "2020-01", usage_liters: 16.832, is_exact: true},
  ];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(doNothing);
  const response = await expressCall(report, new Request("/?site_id=TEST_SITE&type=monthly"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=86400");
  expect(response.json).toHaveBeenCalledWith({
    data,
    timestamp: mockNowTimestamp,
    generated_at: mockNowString,
  });

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      label_format: "%Y-%m",
      start_date: "2017-01-01",
      end_date: "2020-12-31",
      site_id: "TEST_SITE",
      timezone: defaultTimezone,
      usage_decimal_places: REPORTING_DECIMAL_PLACES,
    },
    query: reportDefs.monthly.query,
    useLegacySql: false,
  });
});

test(`default report type is daily`, async () => {
  const log = jest.spyOn(console, "log").mockImplementation(doNothing);
  const response = await expressCall(report, new Request("/?site_id=TEST_SITE"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(mockedQuery).toHaveBeenCalledWith(
    expect.objectContaining({query: reportDefs.daily.query}),
  );
});

test(`supports CORS preflight for any origin`, async () => {
  const request = new Request("/?site_id=TEST_SITE&type=daily", {method: "OPTIONS"});
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(204);
  expect(response.getHeader('Access-Control-Allow-Origin')).toEqual('*');
});

test(`requires site_id param`, async () => {
  const request = new Request("/?type=daily");
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(422);
  expect(response.json).toHaveBeenCalledWith({error: `Param 'site_id' is required`});
});

test(`rejects unexpected report type`, async () => {
  const request = new Request("/?site_id=TEST_SITE&type=semiweekly");
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(422);
  expect(response.json).toHaveBeenCalledWith({error: `Unknown 'type'`});
});

test(`rejects post`, async () => {
  const request = new Request("/?site_id=TEST_SITE&type=daily", {method: "POST"});
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(405);
  expect(response.json).toHaveBeenCalledWith({error: `Method not allowed`});
});

test(`handles duplicate query params`, async () => {
  const log = jest.spyOn(console, "log").mockImplementation(doNothing);
  const response = await expressCall(report,
    new Request("/?site_id=TEST_SITE1&site_id=TEST_SITE2&type=recent&type=monthly"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(mockedQuery).toHaveBeenCalledWith(
    expect.objectContaining({
      query: reportDefs.recent.query,
      params: expect.objectContaining({site_id: "TEST_SITE1"}),
    }),
  );
});

test(`handles BigQuery error`, async () => {
  mockedQuery.mockRejectedValueOnce(new Error("BigQuery error"));

  const log = jest.spyOn(console, "log").mockImplementation(doNothing);
  const consoleError = jest.spyOn(console, "error").mockImplementation(doNothing);
  const response = await expressCall(report, new Request("/?site_id=TEST_SITE&type=recent"));
  log.mockRestore();

  expect(response.statusCode).toEqual(400);
  expect(response.json).toHaveBeenCalledWith({error: `Error: BigQuery error`});

  // Make sure error makes it to the logs
  expect(consoleError).toHaveBeenCalledWith(
    "ERROR:",
    expect.objectContaining({message: "BigQuery error"})
  );
  consoleError.mockRestore();
});
