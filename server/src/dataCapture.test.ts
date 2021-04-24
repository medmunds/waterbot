import {mocked} from 'ts-jest/utils';
import {bigquery} from './bigquery';
import {datasetId, tableId} from './config';
import {dataCapture} from './dataCapture';


// Add asymmetric matcher for floating point
// https://stackoverflow.com/a/53464807/647002
const closeTo = (expected: number, precision = 2) => ({
  asymmetricMatch: (actual: number) => Math.abs(expected - actual) < Math.pow(10, -precision) / 2
});


// Mock BigQuery (as used by dataCapture function)
jest.mock('./bigquery');
const mockedInsert = jest.fn().mockResolvedValue([]);
const mockedTable = jest.fn().mockReturnValue({insert: mockedInsert});
const mockedDataset = jest.fn().mockReturnValue({table: mockedTable});
const mockedBigQuery = mocked(bigquery);
mockedBigQuery.dataset = mockedDataset;


test(`loads particle event data`, async () => {
  const eventData = {
    t: 1619277465,
    seq: 21802,
    per: 303,
    cur: 228231,
    lst: 228220,
    use: 11,
    sig: -59,
    btv: 4.07,
    btp: 99.24,
    v: "0.1.1",
  };
  const encodedEvent = Buffer.from(JSON.stringify(eventData)).toString('base64');
  const message = {
    attributes: {device_id: "TEST_DEVICE_ID", event: "waterbot/data", published_at: "2021-04-24T15:17:46.597Z"},
    data: Buffer.from(encodedEvent, 'base64'),
  }

  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  await dataCapture(message, {});
  log.mockRestore();

  expect(mockedDataset).toHaveBeenCalledWith(datasetId);
  expect(mockedTable).toHaveBeenCalledWith(tableId);
  expect(mockedInsert).toHaveBeenCalledWith({
    insertId: `TEST_DEVICE_ID:1619277465:21802`,
    device_id: "TEST_DEVICE_ID",
    timestamp: 1619277465,
    sequence: 21802,
    period_sec: 303,
    current_reading_cuft: closeTo(22823.1, 1),
    usage_cuft: closeTo(1.1, 1),
    battery_pct: closeTo(99.24, 2),
    battery_v: closeTo(4.07, 2),
    wifi_signal: -59,
    firmware_version: "0.1.1",
  });
});


test(`handles BigQuery insert error`, async () => {
  mockedInsert.mockRejectedValueOnce(new Error("BigQuery error"));
  const message = {
    attributes: {device_id: "TEST_DEVICE_ID", event: "waterbot/data", published_at: "2021-04-24T15:17:46.597Z"},
    data: null,
  }

  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  await dataCapture(message, {});
  log.mockRestore();

  // Make sure error makes it to the logs
  expect(consoleError).toHaveBeenCalledWith(
    "ERROR:",
    expect.objectContaining({message: "BigQuery error"})
  );
  consoleError.mockRestore();
});
