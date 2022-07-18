import {bigquery} from './bigquery';
import {datasetId, deviceTableId, usageTableId} from './config';
import {dataCapture, extractDeviceData, extractUsageData} from './dataCapture';


const mockDeviceInfo: DeviceSiteInfoRow = {
  device_id: "DEVICE",
  site_id: "SITE",
  liters_per_meter_pulse: 1.5,
};

const doNothing = () => {};

// Mock BigQuery (as used by dataCapture function)
jest.mock('./bigquery');
const mockedInsert = jest.fn().mockResolvedValue([]);
const mockedTable = jest.fn().mockReturnValue({insert: mockedInsert});
const mockedDataset = jest.fn().mockReturnValue({table: mockedTable});
const mockedQuery = jest.fn().mockResolvedValue([[mockDeviceInfo]]);
const mockedBigQuery = jest.mocked(bigquery);
mockedBigQuery.dataset = mockedDataset;
mockedBigQuery.query = mockedQuery;


describe(`extractUsageData`, () => {
  test(`typical event`, () => {
    const extracted = extractUsageData(mockDeviceInfo, {
      "t": 10100,
      "at": 10110,
      "seq": 16,
      "per": 75,
      "cur": 2010,
      "lst": 2007,
      "use": 3,
      "pts": [15, 0, 1],
    });
    expect(extracted).toEqual([
      { insertId: "DEVICE:10100:16:0", site_id: "SITE",
        time_start: 10040, time_end: 10040,
        usage_liters: 1.5, usage_meter_units: 1, meter_reading: 2008 },
      { insertId: "DEVICE:10100:16:1", site_id: "SITE",
        time_start: 10040, time_end: 10040,
        usage_liters: 1.5, usage_meter_units: 1, meter_reading: 2009 },
      { insertId: "DEVICE:10100:16:2", site_id: "SITE",
        time_start: 10041, time_end: 10041,
        usage_liters: 1.5, usage_meter_units: 1, meter_reading: 2010 },
    ]);
  });

  test(`zero usage`, () => {
    // e.g., heartbeat event
    const extracted = extractUsageData(mockDeviceInfo, {
      "t": 10100,
      "at": 10110,
      "seq": 17,
      "per": 3600,
      "cur": 2010,
      "lst": 2010,
      "use": 0,
      "pts": [],
    });
    expect(extracted).toEqual([]);
  });

  test(`partially missing pulse timestamps`, () => {
    const extracted = extractUsageData(mockDeviceInfo, {
      "t": 10100,
      "at": 10110,
      "seq": 16,
      "per": 75,
      "cur": 2010,
      "lst": 2004,
      "use": 6,
      "pts": [15, 0, 1],
    });
    expect(extracted).toEqual([
      { insertId: "DEVICE:10100:16", site_id: "SITE",
        time_start: 10025, time_end: 10040,
        usage_liters: 4.5, usage_meter_units: 3, meter_reading: 2007 },
      { insertId: "DEVICE:10100:16:0", site_id: "SITE",
        time_start: 10040, time_end: 10040,
        usage_liters: 1.5, usage_meter_units: 1, meter_reading: 2008 },
      { insertId: "DEVICE:10100:16:1", site_id: "SITE",
        time_start: 10040, time_end: 10040,
        usage_liters: 1.5, usage_meter_units: 1, meter_reading: 2009 },
      { insertId: "DEVICE:10100:16:2", site_id: "SITE",
        time_start: 10041, time_end: 10041,
        usage_liters: 1.5, usage_meter_units: 1, meter_reading: 2010 },
    ]);
  });

  test(`completely missing pulse timestamps`, () => {
    // e.g., positive meter correction
    const extracted = extractUsageData(mockDeviceInfo, {
      "t": 10100,
      "at": 10110,
      "seq": 16,
      "per": 75,
      "cur": 2010,
      "lst": 2004,
      "use": 6,
      "pts": [],
    });
    expect(extracted).toEqual([
      { insertId: "DEVICE:10100:16", site_id: "SITE",
        time_start: 10025, time_end: 10100,
        usage_liters: 9.0, usage_meter_units: 6, meter_reading: 2010 },
    ]);
  });

  test(`negative meter correction`, () => {
    const extracted = extractUsageData(mockDeviceInfo, {
      "t": 10100,
      "at": 10110,
      "seq": 16,
      "per": 75,
      "cur": 2010,
      "lst": 2016,
      "use": -6,
      "pts": [],
    });
    expect(extracted).toEqual([
      { insertId: "DEVICE:10100:16", site_id: "SITE",
        time_start: 10025, time_end: 10100,
        usage_liters: -9.0, usage_meter_units: -6, meter_reading: 2010 },
    ]);
  });

  test(`device reinitialization`, () => {
    const extracted = extractUsageData(mockDeviceInfo, {
      "t": 10100,
      "at": 10110,
      "seq": 16,
      "per": 75,
      "cur": 2010,
      "lst": 0,
      "use": 2010,
      "pts": [],
    });
    // This should *not* record usage for 2010 pulses
    expect(extracted).toEqual([]);
  });
});


describe(`extractDeviceData`, () => {
  beforeEach(() => {
    jest.useFakeTimers({
      now: 1658003600325,
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test(`typical event`, () => {
    const extracted = extractDeviceData(mockDeviceInfo, {
      "t": 1658003367,
      "at": 1658003377,
      "seq": 2,
      "per": 75,
      "cur": 37148,
      "lst": 37143,
      "use": 5,
      "sig": -60,
      "snr": 32,
      "sgp": 80,
      "sqp": 74,
      "btv": 3.9597,
      "btp": 85.9141,
      "try": 3,
      "pts": [15, 12, 13, 12, 13],
      "v": "0.3.9"
    });
    expect(extracted).toEqual({
      insertId: "DEVICE:1658003367:2",
      site_id: "SITE",
      device_id: "DEVICE",
      time_generated: 1658003367,
      time_sent: 1658003377,
      time_received: 1658003600,
      sequence: 2,
      meter_reading: 37148,
      battery_pct: expect.closeTo(85.9141, 4),
      battery_v: expect.closeTo(3.9597, 4),
      wifi_strength_pct: 80,
      wifi_quality_pct: 74,
      wifi_signal_dbm: -60,
      wifi_snr_db: 32,
      network_retry_count: 3,
      firmware_version: "0.3.9",
    });
  });
});


describe(`dataCapture`, () => {
  beforeEach(() => {
    // Not sure why this (alone) needs to be restored before each test
    mockedQuery.mockResolvedValue([[mockDeviceInfo]]);
  });
  beforeEach(() => {
    jest.useFakeTimers({
      now: 1658003600325,
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test(`normal case`, async () => {
    const eventData = {
      "t": 1658004655,
      "at": 1658004659,
      "seq": 22,
      "per": 71,
      "cur": 37255,
      "lst": 37250,
      "use": 5,
      "sig": -62,
      "snr": 30,
      "sgp": 75.9991,
      "sqp": 67.7409,
      "btv": 3.9584,
      "btp": 85.4844,
      "try": 14,
      "pts": [11, 12, 13, 12, 13],
      "v": "0.3.9"
    };
    const encodedEvent = Buffer.from(JSON.stringify(eventData)).toString('base64');
    const message = {
      attributes: {device_id: "DEVICE", event: "waterbot/data", published_at: "2022-07-16T23:30:46.597Z"},
      data: Buffer.from(encodedEvent),
    }

    const log = jest.spyOn(console, "log").mockImplementation(doNothing);
    await dataCapture(message, {});
    log.mockRestore();

    expect(mockedDataset).toHaveBeenCalledWith(datasetId);

    expect(mockedTable).nthCalledWith(1, deviceTableId);
    expect(mockedInsert).nthCalledWith(1, {
      "insertId": "DEVICE:1658004655:22",
      "device_id": "DEVICE",
      "site_id": "SITE",
      "time_generated": 1658004655,
      "time_sent": 1658004659,
      "time_received": 1658003600,
      "sequence": 22,
      "meter_reading": 37255,
      "battery_pct": expect.closeTo(85.4844, 4),
      "battery_v": expect.closeTo(3.9584, 4),
      "wifi_strength_pct": expect.closeTo(75.9991, 4),
      "wifi_quality_pct": expect.closeTo(67.7409, 4),
      "wifi_signal_dbm": -62,
      "wifi_snr_db": 30,
      "network_retry_count": 14,
      "firmware_version": "0.3.9",
    });

    expect(mockedTable).nthCalledWith(2, usageTableId);
    expect(mockedInsert).nthCalledWith(2, [
      {"insertId": "DEVICE:1658004655:22:0", "site_id": "SITE",
        "time_start": 1658004595, "time_end": 1658004595,
        "usage_liters": 1.5, "usage_meter_units": 1, "meter_reading": 37251},
      {"insertId": "DEVICE:1658004655:22:1", "site_id": "SITE",
        "time_start": 1658004607, "time_end": 1658004607,
        "usage_liters": 1.5, "usage_meter_units": 1, "meter_reading": 37252},
      {"insertId": "DEVICE:1658004655:22:2", "site_id": "SITE",
        "time_start": 1658004620, "time_end": 1658004620,
        "usage_liters": 1.5, "usage_meter_units": 1, "meter_reading": 37253},
      {"insertId": "DEVICE:1658004655:22:3", "site_id": "SITE",
        "time_start": 1658004632, "time_end": 1658004632,
        "usage_liters": 1.5, "usage_meter_units": 1, "meter_reading": 37254},
      {"insertId": "DEVICE:1658004655:22:4", "site_id": "SITE",
        "time_start": 1658004645, "time_end": 1658004645,
        "usage_liters": 1.5, "usage_meter_units": 1, "meter_reading": 37255}
    ]);
  });

  test(`handles BigQuery insert error`, async () => {
    mockedInsert.mockRejectedValueOnce(new Error("BigQuery error"));
    const message = {
      attributes: {device_id: "DEVICE", event: "waterbot/data", published_at: "2022-07-16T23:30:46.597Z"},
      data: null,
    }

    const log = jest.spyOn(console, "log").mockImplementation(doNothing);
    const consoleError = jest.spyOn(console, "error").mockImplementation(doNothing);
    await dataCapture(message, {});
    log.mockRestore();

    // Make sure error makes it to the logs
    expect(consoleError).toHaveBeenCalledWith(
      "ERROR:",
      expect.objectContaining({message: "BigQuery error"})
    );
    consoleError.mockRestore();
  });
});
