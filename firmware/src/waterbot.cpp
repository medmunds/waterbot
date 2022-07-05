// ------------
// Pulse counter
// ------------

#include <Particle.h>

#define CIRCULAR_BUFFER_INT_SAFE
#include <CircularBuffer.h>

#include <PowerShield.h>

STARTUP(System.enableFeature(FEATURE_RETAINED_MEMORY));
STARTUP(WiFi.selectAntenna(ANT_AUTO));
SYSTEM_MODE(SEMI_AUTOMATIC);  // wait to connect until we want to
SYSTEM_THREAD(ENABLED);

const char * const WATERBOT_VERSION = "0.3.0";

PowerShield batteryMonitor;


// Some helpful Time.now unit conversions:
#define SECONDS 1
#define MINUTES (60 * SECONDS)
#define HOURS (60 * MINUTES)


// Behavior constants

// publish no more often than the in-use interval while water is running;
// but when water isn't running, publish at least once every heartbeat interval
const time32_t PUBLISH_IN_USE_INTERVAL = 1 * MINUTES; // min between publishes
const time32_t PUBLISH_HEARTBEAT_INTERVAL = 4 * HOURS; // max between publishes

// try to publish immediately if this many pulses
// accumulate before PUBLISH_IN_USE_INTERVAL is reached
const unsigned long PUBLISH_MAX_TIMESTAMPS = 20;

// how many detailed pulse timestamps we can store
// (without publishing, while cloud connection is unavailable);
// beyond this, the total reading will still be accurate,
// but older individual pulse timestamps won't be reported
const unsigned long PULSE_TIMESTAMP_BUFFER_SIZE = 1000;

// pressing the reset button will wake up, connect to the cloud,
// and stay away this long (for setup/diagnostics/updates):
const unsigned long RESET_STAY_AWAKE_INTERVAL = 5 * MINUTES;

// don't bother sleeping for less than this
const time32_t MIN_SLEEP_TIME = 10 * SECONDS;

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

retained time32_t lastPublishTime = 0;
retained unsigned long lastPublishedPulseCount = 0;
retained unsigned long publishCount = 0; // number of publishes since power up


// Non-persistent global data (lost during hibernate)

volatile unsigned long pulsesToSignal = 0;
volatile unsigned long stayAwakeUntilMillis = 0;
volatile bool publishImmediately = false;

char publishDataBuf[particle::protocol::MAX_EVENT_DATA_LENGTH];

Thread *pulseSignalThread = nullptr;

void pulseTimerCallback(void);
Timer pulseDebounceTimer(DEBOUNCE_MSEC, pulseTimerCallback, true);

// FIFO of pulse timestamps (as Time.now() values).
// Populated by pulseISR. Consumed by publishData.
// On overflow, oldest pulse timestamps are lost.
// (Note that CircularBuffer operations are not thread- or
// interrupt-safe, so should be wrapped in ATOMIC_BLOCK.)
CircularBuffer<time32_t, PULSE_TIMESTAMP_BUFFER_SIZE> pulseTimestamps;


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
            pulsesToSignal += 1;
            if (Time.isValid()) {
                pulseTimestamps.push(Time.now());
            }
        }
    }
}


time32_t calcNextPublishTime() {
    // Return timestamp for next required publish, or 0 for publish immediately.
    time32_t nextPublishTime = lastPublishTime + PUBLISH_HEARTBEAT_INTERVAL;

    if (publishImmediately) {
        // Publish requested by cloud function
        nextPublishTime = 0;
    } else {
        // Publish when pulses to report
        ATOMIC_BLOCK() {
            if (!pulseTimestamps.isEmpty()) {
                if (pulseTimestamps.isFull()
                    || pulseTimestamps.size() >= PUBLISH_MAX_TIMESTAMPS
                ) {
                    // Too many pulseTimestamps; publish immediately
                    nextPublishTime = 0;
                } else {
                    // Publish accumulated data after in-use interval
                    nextPublishTime = std::min(
                        pulseTimestamps.first() + PUBLISH_IN_USE_INTERVAL,
                        nextPublishTime
                    );
                }
            }
        }
    }

    return nextPublishTime;
}

bool needToPublish() {
    time32_t now = Time.isValid() ? Time.now() : 0;
    time32_t nextPublishTime = calcNextPublishTime();
    return (now >= nextPublishTime);
}

void publishData() {
    if (!Particle.connected()) {
        Particle.connect();  // turns on WiFi, etc.; blocks until ready
        waitUntil(Particle.connected);
    }

    time32_t now, usageInterval;
    unsigned long thisPulseCount;
    long usage;
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
        writer.name("pts").beginArray();
        ATOMIC_BLOCK() {
            // Consume as many pulseTimestamps as will fit.
            // Publish pulseTimestamps as deltas from previous values
            // (to save on json characters). First timestamp is encoded
            // as delta from start of this interval.
            time32_t previous = now - usageInterval;
            while (!pulseTimestamps.isEmpty()) {
                time32_t ts = pulseTimestamps.shift();
                writer.value(ts - previous);
                previous = ts;

                if (writer.dataSize() > writer.bufferSize() - 15) {
                    // Probably not enough space for another value
                    // (and a comma and trailing ']' and '}' chars)
                    break;
                }
            }
        }
        writer.endArray();
    }
    writer.endObject();
    writer.buffer()[std::min(writer.bufferSize(), writer.dataSize())] = 0;

    // publish event, blocking until success or failure
    if (Particle.publish(EVENT_DATA, publishDataBuf, WITH_ACK)) {
        ATOMIC_BLOCK() {
            lastPublishTime = now;
            lastPublishedPulseCount = thisPulseCount;
            publishCount += 1;
            publishImmediately = false;
        }
    }
}

// Cloud function: arg int newPulseCount
int setReading(String args) {
    long newPulseCount = args.toInt();
    if (newPulseCount < 0 || (newPulseCount == 0 && !args.equals("0"))) {
        return -1;
    }

    time32_t now = Time.now();
    ATOMIC_BLOCK() {
        pulseCount = newPulseCount;
        lastPublishedPulseCount = newPulseCount;
        pulseTimestamps.clear();
        lastPublishTime = now;
        publishImmediately = true;
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
    publishImmediately = true;
    return 0;
}


time32_t calcSleepTime() {
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

    // Sleep until time for next publish
    time32_t now = Time.isValid() ? Time.now() : 0;
    time32_t nextPublishTime = calcNextPublishTime();
    return (nextPublishTime > now) ? nextPublishTime - now : 0;
}

void disconnectCleanly() {
    // Disconnect from Particle Cloud and turn off WiFi power cleanly.
    Particle.disconnect();  // relies on CloudDisconnectOptions.graceful (see setup)
    waitUntil(Particle.disconnected);
    WiFi.off();
}


void sleepDevice(time32_t sleepSecs) {
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
    if (needToPublish()) {
        publishData();
    }

    // sleep if appropriate
    time32_t sleepTime = calcSleepTime();
    if (sleepTime > MIN_SLEEP_TIME) {
        disconnectCleanly();
        sleepTime = calcSleepTime();  // might have changed while waiting for disconnect
        if (sleepTime > MIN_SLEEP_TIME) {
            sleepDevice(sleepTime);
        }
    }
}
