// ------------
// Pulse counter
// ------------

#include <Particle.h>
#include <PowerShield.h>

STARTUP(System.enableFeature(FEATURE_RETAINED_MEMORY));
STARTUP(WiFi.selectAntenna(ANT_AUTO));
SYSTEM_MODE(SEMI_AUTOMATIC);  // wait to connect until we want to
SYSTEM_THREAD(ENABLED);

const char * const WATERBOT_VERSION = "0.2.0";

PowerShield batteryMonitor;


// Some helpful Time.now unit conversions:
#define SECONDS 1
#define MINUTES (60 * SECONDS)
#define HOURS (60 * MINUTES)


// Behavior constants

// publish no more often than the in-use interval while water is running;
// but when water isn't running, publish at least once every heartbeat interval
const unsigned long PUBLISH_IN_USE_INTERVAL = 5 * MINUTES; // min between publishes
const unsigned long PUBLISH_HEARTBEAT_INTERVAL = 4 * HOURS; // max between publishes

// pressing the reset button will wake up, connect to the cloud,
// and stay away this long (for setup/diagnostics/updates):
const unsigned long RESET_STAY_AWAKE_INTERVAL = 5 * MINUTES;

// don't bother sleeping for less than this
const unsigned long MIN_SLEEP_TIME = 10 * SECONDS;

const unsigned long SIGNAL_MSEC_ON = 350;
const unsigned long SIGNAL_MSEC_OFF = 150;

// reject pulses shorter than this as noise
// (must be less than meter pulse width at maximum flow)
const unsigned long DEBOUNCE_MSEC = 300;


// Hardware constants

// PIN_PULSE_SWITCH is meter connection:
//   * must support attachInterrupt
//   * must support wake from ultra-low-power sleep
//   * must not conflict with PowerShield (D0, D1, or D3)
const pin_t PIN_PULSE_SWITCH = D2; // Meter

const pin_t PIN_LED_SIGNAL = D7; // Blink to indicate meter pulses


// Cloud messaging constants

const char* const EVENT_DATA = "waterbot/data"; // publish data to cloud

const char* const FUNC_SET_READING = "setReading"; // reset from cloud
const char* const FUNC_PUBLISH_NOW = "publishNow";
const char* const FUNC_SLEEP_NOW = "sleepNow";


// Persistent data

retained volatile unsigned long pulseCount = 0;  // TODO: cache in EEPROM

retained unsigned long lastPublishTime = 0;
retained unsigned long lastPublishedPulseCount = 0;
retained volatile unsigned long nextPublishInterval = 0; // secs after lastPublishTime
retained unsigned long publishCount = 0; // number of publishes since power up


// Non-persistent global data (lost during hibernate)

volatile unsigned long pulsesToSignal = 0;
volatile unsigned long stayAwakeUntilMillis = 0;

char publishDataBuf[particle::protocol::MAX_EVENT_DATA_LENGTH];

Thread *pulseSignalThread = nullptr;

void pulseTimerCallback(void);
Timer pulseDebounceTimer(DEBOUNCE_MSEC, pulseTimerCallback, true);


inline void stayAwakeForMsec(unsigned long msec) {
    // don't allow sleep until at least msec from now
    unsigned long now = millis();
    if (now + msec > stayAwakeUntilMillis
        || msec > ULONG_MAX - now) // rollover
    {
        stayAwakeUntilMillis = now + msec;
    }
}


void pulseISR() {
    // Interrupt handler for PIN_PULSE_SWITCH.
    // Start (restart) the debounce timer.
    // For a real pulse, the switch will still be closed when the timer fires.
    // For a bounce, we'll end up back in here (and restart the timer) shortly.
    // For transient noise, the switch will re-open before the timer fires.
    pulseDebounceTimer.resetFromISR(); // also starts timer if not already running
}

void pulseTimerCallback() {
    // Callback for debounceTimer. 
    // If pulse switch has stayed closed, record a pulse. 
    // (If switch opened during the timer period, ignore it as noise.)
    ATOMIC_BLOCK() { 
        if (digitalRead(PIN_PULSE_SWITCH) == LOW) {
            pulseCount += 1;
            nextPublishInterval = PUBLISH_IN_USE_INTERVAL;
            pulsesToSignal += 1; 
        }
    }
}


void publishData() {
    if (!Particle.connected()) {
        Particle.connect();  // turns on WiFi, etc.; blocks until ready
        waitUntil(Particle.connected);
    }

    unsigned long now, thisPulseCount, usageInterval, usage;
    ATOMIC_BLOCK() {
        // atomically capture a consistent set of data for the publish
        now = Time.now();
        thisPulseCount = pulseCount;
        usageInterval = now - lastPublishTime;
        usage = thisPulseCount - lastPublishedPulseCount;
    }
    WiFiSignal signal = WiFi.RSSI();  // report whenever we're publishing
    float rssi = signal.getStrengthValue(); // dB [-90, 0]
    float snr = signal.getQualityValue(); // dB [0, 90]
    float cellVoltage = batteryMonitor.getVCell(); // valid 500ms after wakeup (Particle.connect provides sufficient delay)
    float stateOfCharge = batteryMonitor.getSoC();

    // format all our vars into JSON
    JSONBufferWriter writer(publishDataBuf, sizeof(publishDataBuf) - 1);
    writer.beginObject();
    {
        writer.name("t").value(now);
        writer.name("seq").value(publishCount);
        writer.name("per").value(usageInterval);
        writer.name("cur").value(thisPulseCount);
        writer.name("lst").value(lastPublishedPulseCount);
        writer.name("use").value(usage);
        writer.name("sig").value(rssi);
        writer.name("snr").value(snr);
        writer.name("btv").value(cellVoltage);
        writer.name("btp").value(stateOfCharge);
        writer.name("v").value(WATERBOT_VERSION);
    }
    writer.endObject();
    // TODO: if (writer.dataSize() > writer.bufferSize()) message is truncated!
    writer.buffer()[std::min(writer.bufferSize(), writer.dataSize())] = 0;

    // publish event, blocking until success or failure
    if (Particle.publish(EVENT_DATA, publishDataBuf, WITH_ACK)) {
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

    if (pulseDebounceTimer.isActive()) {
        return 0; // stay awake to complete pulse detection
    }

    if (pulsesToSignal > 0) {
        return 0; // stay awake to complete signaling
    }

    if (millis() <= stayAwakeUntilMillis) {
        return 0; // stay awake for minimum period (e.g., after reset)
    }

    if (!Time.isValid()) {
        return 0;
    }
    unsigned long now = Time.now();

    // Sleep until time for next publish
    unsigned int nextPublishTime = lastPublishTime + nextPublishInterval;
    if (nextPublishTime <= now) {
        return 0;
    }
    return nextPublishTime - now;
}

void disconnectCleanly() {
    // Disconnect from Particle Cloud and turn off WiFi power cleanly.
    Particle.disconnect();  // relies on CloudDisconnectOptions.graceful (see setup)
    waitUntil(Particle.disconnected);
    WiFi.off();
}


void sleepDevice(unsigned int sleepSecs) {
    // Enter ultra low power mode (after finishing any cloud communication),
    // waking on PIN_PULSE_SWITCH or after sleepSecs secs.
    System.sleep(
        SystemSleepConfiguration()
            .mode(SystemSleepMode::ULTRA_LOW_POWER)
            .flag(SystemSleepFlag::WAIT_CLOUD)
            .gpio(PIN_PULSE_SWITCH, FALLING)
            .duration(sleepSecs * 1000)
    );
}


void displayPulseSignals() {
    // This runs in a separate thread, so it isn't blocked
    // by long running cloud functions in the main thread.
    // (Note that delay() yields to other threads.)
    while (true) {
        if (pulsesToSignal > 0) {
            digitalWrite(PIN_LED_SIGNAL, HIGH);
            delay(SIGNAL_MSEC_ON);
            ATOMIC_BLOCK() {
                pulsesToSignal -= 1; 
            }
            digitalWrite(PIN_LED_SIGNAL, LOW);
            delay(SIGNAL_MSEC_OFF);
        } else {
            delay(50ms);
        }
    }
}


void setup() {
    pinMode(PIN_LED_SIGNAL, OUTPUT);
    digitalWrite(PIN_LED_SIGNAL, LOW);

    pinMode(PIN_PULSE_SWITCH, INPUT_PULLUP);
    attachInterrupt(PIN_PULSE_SWITCH, pulseISR, FALLING);

    batteryMonitor.begin();
    if (System.resetReason() == RESET_REASON_POWER_DOWN) {
        batteryMonitor.quickStart();
    }

    if (!pulseSignalThread) {
        pulseSignalThread = new Thread(
            "pulseSignal", 
            displayPulseSignals, 
            OS_THREAD_PRIORITY_DEFAULT, 
            256U // only need a tiny stack
        );
    }

    Particle.function(FUNC_SET_READING, setReading);
    Particle.function(FUNC_PUBLISH_NOW, publishNow);
    Particle.function(FUNC_SLEEP_NOW, sleepNow);

    Particle.setDisconnectOptions(
        CloudDisconnectOptions()
            .graceful(true) // required for disconnectCleanly
            .timeout(5s)
    );

    // TODO: maybe check battery level before connecting?
    Particle.connect();
    waitUntil(Particle.connected);
    if (System.resetReason() == RESET_REASON_PIN_RESET) {
        stayAwakeForMsec(RESET_STAY_AWAKE_INTERVAL * 1000);
    }

    // if we lost track of time while powered down, restore it now
    if (!Time.isValid()) {
        waitUntil(Particle.syncTimeDone); // TODO: timeout?
    }
}


void loop() {
    // publish
    if (Time.isValid() && (unsigned long)Time.now() >= lastPublishTime + nextPublishInterval) {
        publishData();
    }

    // sleep if appropriate
    unsigned int sleepTime = calcSleepTime();
    if (sleepTime > MIN_SLEEP_TIME) {
        disconnectCleanly();
        sleepTime = calcSleepTime();  // might have changed while waiting for disconnect
        if (sleepTime > MIN_SLEEP_TIME) {
            sleepDevice(sleepTime);
        }
    }
}
