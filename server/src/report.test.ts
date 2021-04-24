import {Request} from 'jest-express/lib/request';
import {Response} from 'jest-express/lib/response';
import {mocked} from 'ts-jest/utils';
import {bigquery} from './bigquery';
import {CUFT_DECIMAL_PLACES, datasetId, defaultTimezone, projectId} from './config';
import {report, reportDefs} from './report';


// Mock BigQuery (as used by report function)
jest.mock('./bigquery');
const mockedTimestamp = jest.fn().mockReturnValue("MOCKED_TIMESTAMP");
const mockedQuery = jest.fn().mockResolvedValue([[]]);
const mockedBigQuery = mocked(bigquery);
mockedBigQuery.timestamp = mockedTimestamp;
mockedBigQuery.query = mockedQuery;


// Emulate an express-style call to fn
async function expressCall(
  fn: (req: Request, res: Response) => any,
  request: Request,
): Promise<Response> {
  const response = new Response();
  await new Promise((resolve, reject) => {
    response.end.mockImplementation(resolve);
    fn(request, response);
  });
  return response;
}


test(`recent report`, async () => {
  const data = [{
    usage_cuft: 0,
    current_reading_cuft: 22442.7,
    time: "2021-04-08 18:37:43-07:00",
    period_sec: 14403,
    battery_pct: 98.45,
    battery_v: 4.1,
    wifi_signal: -64,
  }, {
    usage_cuft: 0,
    current_reading_cuft: 22442.7,
    time: "2021-04-08 22:37:46-07:00",
    period_sec: 14403,
    battery_pct: 98.93,
    battery_v: 4.1,
    wifi_signal: -63,
  }];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const response = await expressCall(report, new Request("/?device_id=TEST_DEVICE_ID&type=recent"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=300");
  expect(response.json).toHaveBeenCalledWith({data, timestamp: expect.any(Number)});

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      cuft_decimal_places: CUFT_DECIMAL_PLACES,
      device_id: "TEST_DEVICE_ID",
      start_timestamp: "MOCKED_TIMESTAMP",
      timezone: defaultTimezone,
    },
    query: reportDefs.recent.query,
    useLegacySql: false,
  });
});

test(`hourly report`, async () => {
  const data = [{
    hour: "2021-04-08 18-07:00",
    usage_cuft: 0,
    num_readings: 1,
    last_reading_cuft: 22442.7,
    last_reading_time: "2021-04-08 18:37:43-07:00",
    min_battery_pct: 98.45,
    min_battery_v: 4.1,
    avg_wifi_signal: -64,
  }, {
    hour: "2021-04-08 22-07:00",
    usage_cuft: 0,
    num_readings: 1,
    last_reading_cuft: 22442.7,
    last_reading_time: "2021-04-08 22:37:46-07:00",
    min_battery_pct: 98.93,
    min_battery_v: 4.1,
    avg_wifi_signal: -63,
  }];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const response = await expressCall(report, new Request("/?device_id=TEST_DEVICE_ID&type=hourly"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=300");
  expect(response.json).toHaveBeenCalledWith({data, timestamp: expect.any(Number)});

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      cuft_decimal_places: CUFT_DECIMAL_PLACES,
      device_id: "TEST_DEVICE_ID",
      start_timestamp: "MOCKED_TIMESTAMP",
      timezone: defaultTimezone,
    },
    query: reportDefs.hourly.query,
    useLegacySql: false,
  });
});

test(`daily report`, async () => {
  const data = [
    {date: "2019-12-31", usage_cuft: 0, num_readings: 2, last_reading_cuft: 14618.5},
    {date: "2020-01-02", usage_cuft: 0, num_readings: 6, last_reading_cuft: 14618.5},
  ];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const response = await expressCall(report, new Request("/?device_id=TEST_DEVICE_ID&type=daily"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=43200");
  expect(response.json).toHaveBeenCalledWith({data, timestamp: expect.any(Number)});

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      cuft_decimal_places: CUFT_DECIMAL_PLACES,
      device_id: "TEST_DEVICE_ID",
      start_timestamp: "MOCKED_TIMESTAMP",
      timezone: defaultTimezone,
    },
    query: reportDefs.daily.query,
    useLegacySql: false,
  });
});

test(`monthly report`, async () => {
  const data = [
    {month: "2017-12", usage_cuft: 11.8, num_readings: 48, last_reading_cuft: 4424},
    {month: "2018-01", usage_cuft: 81.6, num_readings: 292, last_reading_cuft: 4505.6},
  ];
  mockedQuery.mockResolvedValueOnce([data]);

  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const response = await expressCall(report, new Request("/?device_id=TEST_DEVICE_ID&type=monthly"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(response.getHeader('Cache-Control')).toEqual("public, max-age=86400");
  expect(response.json).toHaveBeenCalledWith({data, timestamp: expect.any(Number)});

  expect(mockedQuery).toHaveBeenCalledWith({
    defaultDataset: {
      datasetId,
      projectId,
    },
    params: {
      cuft_decimal_places: CUFT_DECIMAL_PLACES,
      device_id: "TEST_DEVICE_ID",
      start_timestamp: "MOCKED_TIMESTAMP",
      timezone: defaultTimezone,
    },
    query: reportDefs.monthly.query,
    useLegacySql: false,
  });
});

test(`default report type is daily`, async () => {
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const response = await expressCall(report, new Request("/?device_id=TEST_DEVICE_ID"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(mockedQuery).toHaveBeenCalledWith(
    expect.objectContaining({query: reportDefs.daily.query}),
  );
});

test(`supports CORS preflight for any origin`, async () => {
  const request = new Request("/?device_id=TEST_DEVICE_ID&type=daily", {method: "OPTIONS"});
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(204);
  expect(response.getHeader('Access-Control-Allow-Origin')).toEqual('*');
});

test(`requires device_id param`, async () => {
  const request = new Request("/?type=daily");
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(400);
  expect(response.json).toHaveBeenCalledWith({error: `Param 'device_id' is required`});
});

test(`rejects unexpected report type`, async () => {
  const request = new Request("/?device_id=TEST_DEVICE_ID&type=semiweekly");
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(400);
  expect(response.json).toHaveBeenCalledWith({error: `Unknown 'type'`});
});

test(`rejects post`, async () => {
  const request = new Request("/?device_id=TEST_DEVICE_ID&type=daily", {method: "POST"});
  const response = await expressCall(report, request);

  expect(response.statusCode).toEqual(405);
  expect(response.json).toHaveBeenCalledWith({error: `Method not allowed`});
});

test(`handles duplicate query params`, async () => {
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const response = await expressCall(report,
    new Request("/?device_id=DEVICE1&device_id=DEVICE2&type=recent&type=monthly"));
  log.mockRestore();

  expect(response.statusCode).toEqual(200);
  expect(mockedQuery).toHaveBeenCalledWith(
    expect.objectContaining({
      query: reportDefs.recent.query,
      params: expect.objectContaining({device_id: "DEVICE1"}),
    }),
  );
});

test(`handles BigQuery error`, async () => {
  mockedQuery.mockRejectedValueOnce(new Error("BigQuery error"));

  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const response = await expressCall(report, new Request("/?device_id=TEST_DEVICE_ID&type=recent"));
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
