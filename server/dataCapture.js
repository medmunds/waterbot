// gcloud functions deploy dataCapture --stage-bucket waterbot --trigger-event providers/cloud.pubsub/eventTypes/topic.publish --trigger-resource waterbot-data --runtime nodejs10
// gcloud functions logs read dataCapture --limit 10


const {BigQuery} = require('@google-cloud/bigquery');

const {
  projectId,
  datasetId,
  tableId,
  CUFT_PER_METER_TICK
} = require('./config');

const bigquery = new BigQuery({
    projectId: projectId
});


exports.dataCapture = function dataCapture(data) {
    // Extract the pubsubMessage data from Particle, transform the data, and load it into BigQuery
    const pubsubMessage = data;
    const {device_id, event: event_type, published_at} = pubsubMessage.attributes;
    const eventData = pubsubMessage.data ? JSON.parse(Buffer.from(pubsubMessage.data, 'base64').toString()) : {};
    const {
        t: timestamp,
        seq: sequence,
        per: period_sec,
        cur: currentMeterTicks,
        lst: lastMeterTicks,
        use: usageMeterTicks,
        sig: wifi_signal,
        btv: battery_v,
        btp: battery_pct,
        v: firmware_version,
    } = eventData;

    // Should probably do some validation here -- check firmware_version, ensure readings exist, etc.

    const insertId = `${device_id}:${timestamp}:${sequence}`;
    const current_reading_cuft = currentMeterTicks * CUFT_PER_METER_TICK;
    const usage_cuft = usageMeterTicks * CUFT_PER_METER_TICK;

    const row = {
        insertId,
        device_id,
        timestamp,
        sequence,
        period_sec,
        current_reading_cuft,
        usage_cuft,
        battery_pct,
        battery_v,
        wifi_signal,
        firmware_version,
    };

    // Cloud Function must return a Promise
    return bigquery
        .dataset(datasetId)
        .table(tableId)
        .insert(row)
        .then(function insertSuccess(data) {
            // const apiResponse = data[0];
            console.log('Inserted:', row);
        })
        .catch(function insertError(err) {
            console.error('ERROR:', err);
            if (err.name === 'PartialFailureError') {
                // Insert partially, or entirely failed
                if (err.response && err.response.insertErrors) {
                    console.error('Insert errors:');
                    err.response.insertErrors.forEach((err) => console.error(err));
                }
            } else {
                // `err` could be a DNS error, a rate limit error, an auth error, etc.
            }
        });
};
