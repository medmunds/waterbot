// ------------
// Pulse counter
// ------------

#include <Particle.h>
#include <PowerShield.h>


STARTUP(System.enableFeature(FEATURE_RETAINED_MEMORY));
STARTUP(WiFi.selectAntenna(ANT_AUTO));
SYSTEM_MODE(SEMI_AUTOMATIC);  // wait to connect until we want to


PowerShield batteryMonitor;


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

const int PIN_PULSE_SWITCH = WKP;
const int PIN_LED_SIGNAL = D7; // Used to indicate unpublished data


// Event constants

const char* EVENT_DATA = "waterbot/data";


// Persistent data

retained unsigned long pulseCount = 0;  // TODO: cache in EEPROM

retained unsigned long lastPublishTime = 0;
retained unsigned long lastPublishedPulseCount = 0;
retained unsigned long nextPublishInterval = 0; // secs after lastPublishTime
retained unsigned long publishCount = 0; // number of publishes since power up



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
    unsigned long usage = thisPulseCount - lastPublishedPulseCount;
    int rssi = WiFi.RSSI();  // report whenever we're publishing
    float cellVoltage = batteryMonitor.getVCell(); // valid 500ms after wakeup (Particle.connect provides sufficient delay)
    float stateOfCharge = batteryMonitor.getSoC();

    // format all our vars into JSON; note Particle allows 255 chars max
    String data = String::format(
        "{\"current\": %u, \"last\": %u, \"usage\": %u, \"interval\": %u, \"serial\": %u, \"signal\": %d, \"battV\": %0.2f, \"battPct\": %0.2f}",
        thisPulseCount, lastPublishedPulseCount, usage, usageInterval,
        publishCount, rssi, cellVoltage, stateOfCharge);
    if (Particle.publish(EVENT_DATA, data)) {
        lastPublishTime = now;
        lastPublishedPulseCount = thisPulseCount;
        publishCount += 1;
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


void sleepDevice(unsigned int sleepSecs) {
    // Enter minimum power mode, waking on rising WKP or after sleepTime secs.
    // (Uses deep sleep if possible, with workaround for likely hardware bug
    // when WKP held high during deep sleep: https://github.com/spark/firmware/issues/1262.)
    if (digitalRead(WKP) == LOW) {
        // Can use deep sleep mode
        System.sleep(SLEEP_MODE_DEEP, sleepSecs);
    } else {
        // Must avoid deep sleep until WKP goes low; use stop mode until then
        digitalWrite(PIN_LED_SIGNAL, LOW);  // led stays powered in stop
        System.sleep(WKP, FALLING, sleepSecs);
    }
}


void setup() {
    pinMode(PIN_LED_SIGNAL, OUTPUT);
    digitalWrite(PIN_LED_SIGNAL, (pulseCount > lastPublishedPulseCount) ? HIGH : LOW);

    pinMode(PIN_PULSE_SWITCH, INPUT_PULLDOWN);
    attachInterrupt(PIN_PULSE_SWITCH, checkForPulse, RISING);  // deep sleep requires rising edge

    // if we're waking from deep sleep because of WKP,
    // the interrupt handler won't have been called
    checkForPulse();

    batteryMonitor.begin();
    // batteryMonitor.quickStart();  // TODO: maybe run the first time we power up?
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
            sleepDevice(sleepTime);
        }
    }
}
