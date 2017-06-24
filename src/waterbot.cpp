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

// pressing the reset button will wake up, connect to the cloud,
// and stay away this long (for setup/diagnostics/updates):
const unsigned long RESET_STAY_AWAKE_INTERVAL = 5 * MINUTES;

const unsigned long SIGNAL_MSEC_ON = 350;
const unsigned long SIGNAL_MSEC_OFF = 150;

const unsigned long DEBOUNCE_MSEC = 300;


// Hardware constants

const int PIN_PULSE_SWITCH = WKP;
const int PIN_LED_SIGNAL = D7; // Blink to indicate meter pulses


// Cloud messaging constants

const char* EVENT_DATA = "waterbot/data"; // publish data to cloud

const char* FUNC_SET_READING = "setReading"; // reset from cloud
const char* FUNC_PUBLISH_NOW = "publishNow";
const char* FUNC_SLEEP_NOW = "sleepNow";


// Persistent data

retained volatile unsigned long pulseCount = 0;  // TODO: cache in EEPROM

retained unsigned long lastPublishTime = 0;
retained unsigned long lastPublishedPulseCount = 0;
retained volatile unsigned long nextPublishInterval = 0; // secs after lastPublishTime
retained unsigned long publishCount = 0; // number of publishes since power up


// Non-persistent global data (lost during deep sleep)

volatile unsigned long pulsesToSignal = 0;
volatile unsigned long stayAwakeUntilMillis = 0;


inline void stayAwakeForMsec(unsigned long msec) {
    // don't allow sleep until at least msec from now
    unsigned long now = millis();
    if (now + msec > stayAwakeUntilMillis
        || msec > ULONG_MAX - now) // rollover
    {
        stayAwakeUntilMillis = now + msec;
    }
}

void checkForPulse() {
    // Called for both pulse interrupts and timeout wakeup from deep sleep.
    // Check the pulse pin status to disambiguate.
    // https://community.particle.io/t/photon-wkp-pin-interupt-flag-question/14280/3
    static unsigned long lastPulseMillis = 0;
    unsigned long now = millis();
    if (digitalRead(PIN_PULSE_SWITCH) == HIGH
        && (lastPulseMillis == 0 || now >= lastPulseMillis + DEBOUNCE_MSEC)
    ) {
        lastPulseMillis = now;
        pulseCount += 1;
        nextPublishInterval = PUBLISH_IN_USE_INTERVAL;
        pulsesToSignal += 1;
        stayAwakeForMsec(DEBOUNCE_MSEC);
    }
}


void publishData() {
    if (!Particle.connected()) {
        Particle.connect();  // turns on WiFi, etc.; blocks until ready
    }

    unsigned long now, thisPulseCount, usageInterval, usage;
    ATOMIC_BLOCK() {
        // atomically capture a consistent set of data for the publish
        now = Time.now();
        thisPulseCount = pulseCount;
        usageInterval = now - lastPublishTime;
        usage = thisPulseCount - lastPublishedPulseCount;
    }
    int rssi = WiFi.RSSI();  // report whenever we're publishing
    float cellVoltage = batteryMonitor.getVCell(); // valid 500ms after wakeup (Particle.connect provides sufficient delay)
    float stateOfCharge = batteryMonitor.getSoC();

    // format all our vars into JSON; note Particle allows 255 chars max
    String data = String::format(
        "{\"current\": %u, \"last\": %u, \"usage\": %u, \"interval\": %u, \"serial\": %u, \"signal\": %d, \"battV\": %0.2f, \"battPct\": %0.2f}",
        thisPulseCount, lastPublishedPulseCount, usage, usageInterval,
        publishCount, rssi, cellVoltage, stateOfCharge);
    if (Particle.publish(EVENT_DATA, data)) {
        ATOMIC_BLOCK() {
            lastPublishTime = now;
            lastPublishedPulseCount = thisPulseCount;
            publishCount += 1;
            if (pulseCount == thisPulseCount) {
                // if there's no earlier event, reconnect at the heartbeat interval
                nextPublishInterval = PUBLISH_HEARTBEAT_INTERVAL;
            }
        }
    }
}

// Cloud function: arg int newPulseCount
int setReading(String args) {
    long newPulseCount = args.toInt();
    if (newPulseCount < 0 || (newPulseCount == 0 && !args.equals("0"))) {
        return -1;
    }

    unsigned long now = Time.now();
    ATOMIC_BLOCK() {
        pulseCount = newPulseCount;
        lastPublishedPulseCount = newPulseCount;
        lastPublishTime = now;
        nextPublishInterval = 0; // publish immediately
    }
    return 0;
}

// Cloud function
int sleepNow(String args) {
    stayAwakeUntilMillis = millis();
    return 0;
}

// Cloud function
int publishNow(String args) {
    nextPublishInterval = 0;
    return 0;
}


unsigned int calcSleepTime() {
    // Returns number of seconds to sleep -- or zero if we shouldn't sleep yet

    // First, are we still doing work we need to stay awake for?
    if (millis() <= stayAwakeUntilMillis) {
        return 0;
    }

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

    if (pulsesToSignal > 0) {
        return 0; // stay awake to signal reading
    }

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
        System.sleep(WKP, FALLING, sleepSecs);
    }
}


void setup() {
    pinMode(PIN_LED_SIGNAL, OUTPUT);
    digitalWrite(PIN_LED_SIGNAL, LOW);

    pinMode(PIN_PULSE_SWITCH, INPUT_PULLDOWN);
    attachInterrupt(PIN_PULSE_SWITCH, checkForPulse, RISING);  // deep sleep requires rising edge

    // why are we powering up?
    switch (System.resetReason()) {
    case RESET_REASON_PIN_RESET:
        // user pressed reset button
        Particle.connect(); // blocks!
        stayAwakeForMsec(RESET_STAY_AWAKE_INTERVAL * 1000);
        break;
    case RESET_REASON_POWER_MANAGEMENT:
        // waking from deep sleep
        // if this was due to WKP, need to record the pulse
        checkForPulse();
        break;
    case RESET_REASON_POWER_DOWN:
        // battery/power re-attached
        // maybe call batteryMonitor.quickStart() (after batteryMonitor.begin())
        break;
    case RESET_REASON_UPDATE:
        // new firmware
        break;
    default:
        // safe mode, etc. are handled by system firmware
        break;
    }

    batteryMonitor.begin();

    Particle.function(FUNC_SET_READING, setReading);
    Particle.function(FUNC_PUBLISH_NOW, publishNow);
    Particle.function(FUNC_SLEEP_NOW, sleepNow);

    // if we lost track of time while powered down, restore it now
    if (!Time.isValid()) {
        if (!Particle.connected()) {
            Particle.connect();
        }
        waitUntil(Particle.syncTimeDone); // TODO: timeout?
    }
}


void loop() {
    // publish
    if (Time.isValid() && Time.now() >= lastPublishTime + nextPublishInterval) {
        publishData();
    }

    if (pulsesToSignal > 0) {
        pulsesToSignal -= 1;
        digitalWrite(PIN_LED_SIGNAL, HIGH);
        delay(SIGNAL_MSEC_ON);
        digitalWrite(PIN_LED_SIGNAL, LOW);
        if (pulsesToSignal > 0) {
            delay(SIGNAL_MSEC_OFF);
        }
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
