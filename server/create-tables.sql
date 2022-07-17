-- noinspection SqlNoDataSourceInspectionForFile

CREATE TABLE IF NOT EXISTS `waterbot.device_site_info`
(
  device_id STRING NOT NULL OPTIONS(description="Particle device identifier"),
  site_id STRING NOT NULL OPTIONS(description="Identifier for this installation/location"),
  liters_per_meter_pulse FLOAT64 NOT NULL OPTIONS(description="Meter conversion factor"),
) OPTIONS (
  description = 'Site resolution from device IDs',
  labels = [('project', 'waterbot')]
);

CREATE TABLE IF NOT EXISTS `waterbot.usage_data`
(
  insertId STRING NOT NULL,
  site_id STRING NOT NULL OPTIONS(description="Identifier for this installation/location"),
  time_start TIMESTAMP NOT NULL OPTIONS(description="Start of reporting period (UTC timestamp)"),
  time_end TIMESTAMP NOT NULL OPTIONS(description="End of reporting period (UTC timestamp); can equal time_start"),
  usage_liters FLOAT64 NOT NULL OPTIONS(description="Water used during reporting period (liters)"),
  meter_reading INT OPTIONS(description="Meter reading at time_end, if known (in meter pulse units)")
) OPTIONS (
  description = 'Water consumption data',
  labels = [('project', 'waterbot')]
);

CREATE TABLE IF NOT EXISTS `waterbot.device_data`
(
  insertId STRING NOT NULL,
  site_id STRING NOT NULL OPTIONS(description="Identifier for this installation/location"),
  device_id STRING NOT NULL OPTIONS(description="Particle device identifier"),
  time_generated TIMESTAMP NOT NULL OPTIONS(description="Time meter read (UTC timestamp)"),
  time_sent TIMESTAMP NOT NULL OPTIONS(description="Time report sent (UTC timestamp)"),
  time_received TIMESTAMP NOT NULL OPTIONS(description="Time report arrived at server (UTC timestamp)"),
  `sequence` INT64 OPTIONS(description="Serial number of the report (resets on battery change)"),
  meter_reading INT OPTIONS(description="Current meter reading at time_generated (in meter pulse units)"),
  battery_pct FLOAT64 OPTIONS(description="Estimated battery level at time_sent (100 is fully charged; can exceed 100)"),
  battery_v FLOAT64 OPTIONS(description="Battery voltage at time_sent (3.7 nominal; can exceed 4)"),
  wifi_strength_pct FLOAT64 OPTIONS(description="WiFi strength at time_sent (0 - 100)"),
  wifi_quality_pct FLOAT64 OPTIONS(description="WiFi quality at time_sent (0 - 100)"),
  wifi_signal_dbm INT64 OPTIONS(description="WiFi RSSI level at time_sent (dBm, -90 - 0)"),
  wifi_snr_db INT64 OPTIONS(description="WiFi signal/noise ratio at time_sent (db, 0 - 90)"),
  network_retry_count INT64 OPTIONS(description="Number of previous failed attempts to send this report"),
  firmware_version STRING OPTIONS(description="Waterbot firmware version")
) OPTIONS (
  description = 'Device status data',
  labels = [('project', 'waterbot')]
);
