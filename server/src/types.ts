/**
 * Particle pubsub data format
 */
interface ParticleMessageAttributes {
  device_id: string;
  event: string; // json
  published_at: number; // timestamp
}


/**
 * waterbot/data event schema
 * (see firmware)
 */
interface WaterbotDataPayload {
  t: number;
  at: number;
  seq: number;
  per: number;
  cur: number;
  lst: number;
  use: number;
  sig?: number;
  snr?: number;
  sgp?: number;
  sqp?: number;
  btv?: number;
  btp?: number;
  try?: number;
  pts?: Array<number>;
  v?: string;
}

/**
 * device_site_info BigQuery table schema
 */
interface DeviceSiteInfoRow {
  device_id: string;
  site_id: string;
  liters_per_meter_pulse: number;
  // FUTURE: time_valid_start, time_valid_end
}

/**
 * usage_data BigQuery table schema
 */
interface UsageDataRow {
  insertId: string;
  site_id: string;
  time_start: number; // timestamp
  time_end: number; // timestamp
  usage_liters: number; // float64
  meter_reading?: number;
}

/**
 * device_data BigQUery table schema
 */
interface DeviceDataRow {
  insertId: string;
  site_id: string;
  device_id: string;
  time_generated: number; // timestamp
  time_sent: number; // timestamp
  time_received: number; // timestamp
  sequence?: number;
  meter_reading?: number;
  battery_pct?: number;
  battery_v?: number;
  wifi_strength_pct?: number;
  wifi_quality_pct?: number;
  wifi_signal_dbm?: number;
  wifi_snr_db?: number;
  network_retry_count?: number;
  firmware_version?: string;
}
