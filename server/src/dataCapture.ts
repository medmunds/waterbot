// gcloud functions deploy dataCapture --stage-bucket waterbot --trigger-event providers/cloud.pubsub/eventTypes/topic.publish --trigger-resource waterbot-data --runtime nodejs14
// gcloud functions logs read dataCapture --limit 10


import type {EventFunction} from '@google-cloud/functions-framework/build/src/functions';
import bigqueryTypes from "@google-cloud/bigquery/build/src/types";
import ITableDataInsertAllResponse = bigqueryTypes.ITableDataInsertAllResponse;
import type {Message} from '@google-cloud/pubsub';
import {bigquery} from './bigquery';
import {
  datasetId,
  projectId,
  usageTableId,
  deviceTableId,
  deviceSiteInfoTableId,
} from './config';


/**
 * Extract and record a waterbot/data event into the DB.
 */
export const dataCapture: EventFunction = async (data) => {
  // Extract the pubsubMessage data from Particle, transform the data, and load it into BigQuery
  const pubsubMessage = data as Message;
  const {device_id: deviceId} = pubsubMessage.attributes as unknown as ParticleMessageAttributes;
  const eventData: WaterbotDataPayload = pubsubMessage.data
    ? JSON.parse(
      Buffer.from(pubsubMessage.data.toString(), 'base64')
        .toString('utf-8'))
    : {};

  const dataset = bigquery.dataset(datasetId);

  const deviceInfo = await getDeviceSiteInfo(deviceId);
  if (!deviceInfo) {
    console.error(`Unrecognized deviceId ${deviceId}`);
    return;
  }
  // console.log('Using device site info:', deviceInfo);

  const deviceData = extractDeviceData(deviceInfo, eventData);
  try {
    await dataset.table(deviceTableId).insert(deviceData);
    console.log('Inserted device data:', deviceData);
  } catch (err) {
    reportInsertError(err);
  }

  const usageData = extractUsageData(deviceInfo, eventData);
  if (usageData.length > 0) {
    try {
      await dataset.table(usageTableId).insert(usageData);
      console.log('Inserted usage data:', usageData);
    } catch (err) {
      reportInsertError(err);
    }
  } else {
    console.log(`No usage data to insert`);
  }
}


/**
 * Load site info for a particular device ID.
 */
async function getDeviceSiteInfo(deviceId: string): Promise<DeviceSiteInfoRow | undefined> {
  const [result] = await bigquery.query({
    query: `SELECT * FROM \`${deviceSiteInfoTableId}\` WHERE device_id = @device_id`,
    params: {device_id: deviceId},
    useLegacySql: false,
    defaultDataset: {
      projectId,
      datasetId,
    },
  });
  if (result.length < 1) {
    return undefined;
  }
  if (result.length > 1) {
    // If devices need to change
    console.warn(`Duplicate device ID '${deviceId}'`);
  }
  return result.pop();
}

/**
 * Generate a list of rows to insert in the usage_data table
 * for the given waterbot/data event.
 *
 * Returns 0 rows if no usage data to record (e.g., for a heartbeat event).
 */
export function extractUsageData(deviceInfo: DeviceSiteInfoRow, eventData: WaterbotDataPayload): Array<UsageDataRow> {
  const usageData: Array<UsageDataRow> = [];
  const {
    t: timeOfReading,
    seq: sequence,
    per: readingPeriod,
    cur: currentMeterReading,
    lst: previousMeterReading,
    use: reportedUsagePulses,
    pts: pulseTimestamps = [],
  } = eventData;
  const {
    device_id: deviceId,
    site_id: siteId,
    liters_per_meter_pulse: litersPerMeterPulse,
  } = deviceInfo;

  // If 'lst' is 0, device has been reinitialized and 'use' must be ignored.
  const usagePulses = previousMeterReading > 0 ? reportedUsagePulses : 0;
  let timeStart = timeOfReading - readingPeriod;
  let meterReading = currentMeterReading - pulseTimestamps.length;

  const missingPulses = usagePulses - pulseTimestamps.length;
  if (missingPulses !== 0) {
    // Individual timestamps lost at beginning of period
    // OR meter correction (positive or negative).
    // Add a single UsageDataRow capturing this.
    const timeEnd = pulseTimestamps.length > 0
      ? timeStart + pulseTimestamps[0]
      : timeOfReading;
    usageData.push({
      insertId: `${deviceId}:${timeOfReading}:${sequence}`,
      site_id: siteId,
      time_start: timeStart,
      time_end: timeEnd,
      usage_liters: missingPulses * litersPerMeterPulse,
      usage_meter_units: missingPulses,
      meter_reading: meterReading,
    });
  }
  pulseTimestamps.forEach((timestampDelta, pulseIndex) => {
    timeStart += timestampDelta; // pulseTimestamps are delta encoded
    meterReading += 1;
    usageData.push({
      insertId: `${deviceId}:${timeOfReading}:${sequence}:${pulseIndex}`,
      site_id: siteId,
      time_start: timeStart,
      time_end: timeStart, // single pulse occupies 0 time
      usage_liters: litersPerMeterPulse, // exactly one pulse's worth
      usage_meter_units: 1,
      meter_reading: meterReading,
    });
  });

  return usageData;
}

/**
 * Generate a single row to record in the device data table
 * for the given waterbot/data event.
 */
export function extractDeviceData(deviceInfo: DeviceSiteInfoRow, eventData: WaterbotDataPayload): DeviceDataRow {
  const {
    t: time_generated,
    at: time_sent,
    seq: sequence,
    cur: meter_reading,
    sig: wifi_signal_dbm,
    snr: wifi_snr_db,
    sgp: wifi_strength_pct,
    sqp: wifi_quality_pct,
    btv: battery_v,
    btp: battery_pct,
    try: network_retry_count = 0,
    v: firmware_version = "unknown",
  } = eventData;
  // Could also (instead?) track Message.publishTime or ParticleMessageAttributes.published_at
  const time_received = Math.floor(+Date.now() / 1000);
  const {site_id: siteId, device_id: deviceId} = deviceInfo;

  return {
    insertId: `${deviceId}:${time_generated}:${sequence}`,
    site_id: siteId,
    device_id: deviceId,
    time_generated,
    time_sent,
    time_received,
    sequence,
    meter_reading: meter_reading,
    battery_pct,
    battery_v,
    wifi_strength_pct,
    wifi_quality_pct,
    wifi_signal_dbm,
    wifi_snr_db,
    network_retry_count,
    firmware_version,
  };
}


// (seems like this should be in BigQuery typings somewhere)
interface PartialFailureError extends Error {
  response?: ITableDataInsertAllResponse;
}

function isPartialFailureError(err: unknown): err is PartialFailureError {
  return err instanceof Error && err.name === "PartialFailureError";
}

function reportInsertError(err: unknown) {
  console.error('ERROR:', err);
  if (isPartialFailureError(err) && err.response?.insertErrors) {
    console.error('Insert errors:');
    for (let insertError of err.response.insertErrors) {
      console.error(insertError);
    }
  }
}
