// ------------
// Pulse counter
// ------------

#include <Particle.h>

STARTUP(System.enableFeature(FEATURE_RETAINED_MEMORY));
STARTUP(WiFi.selectAntenna(ANT_AUTO));
SYSTEM_MODE(SEMI_AUTOMATIC);  // wait to connect until we want to


// Some helpful Time.now unit conversions:
#define SECONDS 1
#define MINUTES (60 * SECONDS)
#define HOURS (60 * MINUTES)


// Behavior constants

// publish no more often than the in-use interval while water is running;
// but when water isn't running, publish at least once every heartbeat interval
const unsigned long PUBLISH_IN_USE_INTERVAL = 15 * SECONDS; // 15 * MINUTES; // min between publishes
const unsigned long PUBLISH_HEARTBEAT_INTERVAL = 1 * MINUTES; // 24 * HOURS; // max between publishes


// Hardware constants

const int PIN_PULSE_SWITCH = D2;
const int PIN_LED_SIGNAL = D7; // Used to indicate unpublished data


// Event constants

const char* EVENT_DATA = "waterbot/data";


// Persistent data

retained unsigned long pulseCount = 0;  // TODO: cache in EEPROM

retained unsigned long lastPublishTime = 0;
retained unsigned long lastPublishCount = 0;
retained unsigned long nextPublishInterval = 0; // secs after lastPublishTime



void checkForPulse() {
    // Called for both pulse interrupts and timeout wakeup from deep sleep.
    // Check the pulse pin status to disambiguate.
    // https://community.particle.io/t/photon-wkp-pin-interupt-flag-question/14280/3
    if (digitalRead(PIN_PULSE_SWITCH) == HIGH) {
        pulseCount += 1;
        nextPublishInterval = PUBLISH_IN_USE_INTERVAL;
        digitalWrite(PIN_LED_SIGNAL, HIGH);
    }
}


void publishData() {
    if (!Particle.connected()) {
        Particle.connect();  // turns on WiFi, etc.; blocks until ready
    }

    // TODO: some of this data capture probably needs to be in a critical section...
    unsigned long now = Time.now();
    unsigned long thisPulseCount = pulseCount;  // capture in case we're interrupted
    unsigned long usageInterval = now - lastPublishTime;
    unsigned long usage = thisPulseCount - lastPublishCount;
    int rssi = WiFi.RSSI();  // report whenever we're publishing

    // format all our vars into JSON; note Particle allows 255 chars max
    String data = String::format(
        "{\"current\": %u, \"last\": %u, \"usage\": %u, \"interval\": %u, \"signalStrength\": %d}",
        thisPulseCount, lastPublishCount, usage, usageInterval, rssi);
    if (Particle.publish(EVENT_DATA, data)) {
        lastPublishTime = now;
        lastPublishCount = thisPulseCount;
        if (pulseCount == thisPulseCount) {
            // if there's no earlier event, reconnect at the heartbeat interval
            nextPublishInterval = PUBLISH_HEARTBEAT_INTERVAL;
            digitalWrite(PIN_LED_SIGNAL, LOW);
        }
    }
}

unsigned int calcSleepTime() {
    // Returns number of seconds to sleep -- or zero if we shouldn't sleep yet

    // First, are we still doing work we need to stay awake for?
    if (!Time.isValid()) {
        return 0;
    }
    unsigned long now = Time.now();

    if (now < lastPublishTime + 5 * SECONDS) {
        // Publishing in progress: wait 5 seconds to drain queue.
        // (See https://github.com/spark/firmware/issues/1165.
        // In firmware 0.7, should instead be able to check result
        // of Particle.publish as a Future.)
        return 0;
    }
    // TODO: check if firmware update in progress

    // Sleep until time for next publish
    unsigned int nextPublishTime = lastPublishTime + nextPublishInterval;
    if (nextPublishTime <= now) {
        return 0;
    }
    return nextPublishTime - now;
}


void disconnectCleanly() {
    // complete processing any queued events before disconnecting
    // https://community.particle.io/t/electron-product-connects-to-the-cloud-but-cant-get-queued-firmware-updates/30741/8
    Particle.disconnect();
    while (!Particle.disconnected()) {
        for (int i = 0; i < 100; i++) {
            Particle.process();
            delay(10);
        }
    }
    WiFi.off();
}


void setup() {
    pinMode(PIN_LED_SIGNAL, OUTPUT);
    digitalWrite(PIN_LED_SIGNAL, (pulseCount > lastPublishCount) ? HIGH : LOW);

    pinMode(PIN_PULSE_SWITCH, INPUT_PULLDOWN);  // system.sleep sets this for WKP
    attachInterrupt(PIN_PULSE_SWITCH, checkForPulse, RISING);  // deep sleep requires rising edge

    // if we're waking from deep sleep because of WKP,
    // the interrupt handler won't have been called
    checkForPulse();
}


void loop() {
    // if we're waking from sleep, make sure we still have correct time
    bool isInitialized = nextPublishInterval > 0;
    if (isInitialized && !Time.isValid()) {
        if (!Particle.connected()) {
            Particle.connect();
        }
        waitUntil(Particle.syncTimeDone); // TODO: timeout?
    }

    // publish
    if (Time.isValid() && Time.now() >= lastPublishTime + nextPublishInterval) {
        publishData();
    }

    // sleep
    unsigned int sleepTime = calcSleepTime();
    if (sleepTime > 0) {
        disconnectCleanly();
        sleepTime = calcSleepTime();  // might be less than before, if disconnecting took a while
        if (sleepTime > 0) {
            System.sleep(SLEEP_MODE_DEEP, sleepTime);
        }
    }
}
