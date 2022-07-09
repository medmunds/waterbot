// ------------
// Pulse counter
// ------------

#include <Particle.h>

#include <CircularBuffer.h>
#include <PowerShield.h>

STARTUP(System.enableFeature(FEATURE_RETAINED_MEMORY));
STARTUP(WiFi.selectAntenna(ANT_AUTO));
SYSTEM_MODE(SEMI_AUTOMATIC);  // wait to connect until we want to
SYSTEM_THREAD(ENABLED);

const char * const WATERBOT_VERSION = "0.3.7";

// Behavior constants

// publish no more often than the in-use interval while water is running;
// but when water isn't running, publish at least once every heartbeat interval
const std::chrono::seconds PUBLISH_IN_USE_INTERVAL = 1min;
const std::chrono::seconds PUBLISH_HEARTBEAT_INTERVAL = 4h;

// try to publish immediately if this many pulses
// accumulate before PUBLISH_IN_USE_INTERVAL is reached
const uint32_t PUBLISH_MAX_PULSE_TIMES = 20;

// how many detailed pulse times we can store
// (without publishing, while cloud connection is unavailable);
// beyond this, the total reading will still be accurate,
// but older individual pulse times will be lost
const uint32_t PULSE_TIMES_BUFFER_SIZE = 700;

// pressing the reset button will wake up, connect to the cloud,
// and stay away this long (for setup/diagnostics/updates):
const std::chrono::seconds RESET_STAY_AWAKE_INTERVAL = 10min;

// don't bother sleeping for less than this
const std::chrono::seconds MIN_SLEEP_INTERVAL = 10s;

// never publish more often than this (Particle event throttling)
const std::chrono::seconds PUBLISH_MIN_INTERVAL = 5s;

// timeouts for connecting to WiFi and cloud
const std::chrono::seconds NETWORK_CONNECT_TIMEOUT = 15s;
const std::chrono::seconds CLOUD_CONNECT_TIMEOUT = 30s;
const std::chrono::seconds CLOUD_DISCONNECT_TIMEOUT = 10s;

// retry delays when experiencing network issues
const std::chrono::seconds NETWORK_PROBLEM_INITIAL_DELAY = 1min;
const std::chrono::seconds NETWORK_PROBLEM_MAX_DELAY = 4h;

// timing for pulse signalling (on the user LED)
const std::chrono::milliseconds SIGNAL_MSEC_ON = 350ms;
const std::chrono::milliseconds SIGNAL_MSEC_OFF = 150ms;

// reject pulses shorter than this as noise
// (must be less than meter pulse width at maximum flow)
const std::chrono::milliseconds DEBOUNCE_MSEC = 300ms;


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
const char* const FUNC_SELECT_ANTENNA = "selectAntenna";

// FIFO of pulse timestamps (as Time.now() values).
// Populated by pulseISR. Consumed by publishData.
// On overflow, oldest pulse timestamps are lost.
// (Note that CircularBuffer operations are not thread- or
// interrupt-safe, so should be wrapped in ATOMIC_BLOCK.)
typedef CircularBuffer<time32_t, PULSE_TIMES_BUFFER_SIZE> PulseTimesBuffer;

// Version of DeviceOS Timer that supports chrono expressions in constructor.
class MillisecondTimer : public Timer {
public:
    MillisecondTimer(std::chrono::milliseconds period, timer_callback_fn callback_, bool one_shot=false)
        : Timer(period.count(), callback_, one_shot) {}
};

// Value that is not (and is always less than) Time.now()
const time32_t INVALID_TIME = 0;

//
// Retained data (backup RAM / SRAM)
// So long as the device maintains battery power, this data will survive
// reset, all forms of sleep (including hibernate), and (often) firmware updates.
//

typedef struct {
    // Keep all retained data in a single struct to prevent the compiler from
    // rearranging it in newer versions. (It may still get relocated, which is
    // detected by the magic number.)
    // https://community.particle.io/t/retained-variables-are-reset-after-adding-a-new-one/58847/2
    uint32_t magic;
    uint16_t size;
    uint16_t dataLayoutVersion;

    // Current meter reading:
    volatile uint32_t currentPulseCount;

    // Updated on successful publish:
    time32_t lastPublishTime;
    uint32_t lastPublishPulseCount;
    uint32_t publishCount; // number of publishes since power up

    // In-progress publish attempt:
    time32_t pendingPublishTime; // INVALID_TIME if publish not in progress
    uint32_t pendingPublishPulseCount;
    std::array<time32_t, PUBLISH_MAX_PULSE_TIMES + 2> pendingPublishPulseTimes;
    // (+2 in case a few pulses sneak in as we're waking and deciding whether to publish)

    // Captured, not-yet-reported times for each pulse:
    // PulseTimesBuffer pulseTimes; // (doesn't work, because constructor runs on every reset)
    uint8_t pulseTimesBuf[sizeof(PulseTimesBuffer)]; // workaround
    PulseTimesBuffer& pulseTimes = reinterpret_cast<PulseTimesBuffer&>(pulseTimesBuf);

    // If you add fields, add an initializer to validateRetainedData().
    // If you rearrange or resize any fields, also increment this:
    const uint16_t CURRENT_DATA_LAYOUT_VERSION = 3;

} retainedData_t;

retained retainedData_t retainedData;
static_assert(sizeof(retainedData_t) <= 3068,
    "Photon has only 3068 bytes of backup RAM for retainedData.");

// Simplify read access to retainedData members:
const auto& currentPulseCount = retainedData.currentPulseCount;
const auto& lastPublishTime = retainedData.lastPublishTime;
const auto& lastPublishPulseCount = retainedData.lastPublishPulseCount;
const auto& publishCount = retainedData.publishCount;
const auto& pendingPublishTime = retainedData.pendingPublishTime;
const auto& pendingPublishPulseCount = retainedData.pendingPublishPulseCount;
const auto& pendingPublishPulseTimes = retainedData.pendingPublishPulseTimes;
const auto& pulseTimes = retainedData.pulseTimes;

// Don't change this (or you will invalidate all retainedData).
// It's just a fixed, randomly-generated, non-zero number.
const uint32_t RETAINED_DATA_MAGIC = 0x8abfc1b1;


//
// Non-persistent global data (lost during hibernate or reset)
//

volatile uint32_t pulsesToSignal = 0;
volatile bool publishImmediately = false;

time32_t stayAwakeUntilTime = 0; // prevents sleeping when > Time.now()
time32_t earliestNextPublishTime = 0; // delays publish attempts when > Time.now()
time32_t networkProblemRetryDelay = 0; // seconds; 0 when no network problems

PowerShield batteryMonitor;

Thread *pulseSignalThread = nullptr;

void pulseTimerCallback(void);
MillisecondTimer pulseDebounceTimer(DEBOUNCE_MSEC, pulseTimerCallback, true);

LEDStatus ledSignalNetworkProblem(
    RGB_COLOR_ORANGE, LED_PATTERN_BLINK,
    LED_SPEED_FAST, LED_PRIORITY_NORMAL);

LEDStatus ledSignalTimeInvalid(
    RGB_COLOR_RED, LED_PATTERN_BLINK,
    LED_SPEED_FAST, LED_PRIORITY_IMPORTANT);

//
// Code
//

bool validateRetainedData() {
    // Verify retainedData is usable, or initialize if not.
    // Returns false if data needed to be reinitialized.

    if (retainedData.magic == RETAINED_DATA_MAGIC
        && retainedData.size == sizeof(retainedData)
        && retainedData.dataLayoutVersion == retainedData.CURRENT_DATA_LAYOUT_VERSION
    ) {
        // retainedData is (probably) fine
        return true;
    }

    // Either retainedData has never been initialized,
    // or its layout has changed (due to a firmware update).
    // For now, just re-initialize everything.
    // (Could get fancier with version migrations if needed later.)

    retainedData.currentPulseCount = 0;
    retainedData.lastPublishTime = INVALID_TIME;
    retainedData.lastPublishPulseCount = 0;
    retainedData.publishCount = 0;
    retainedData.pendingPublishTime = INVALID_TIME;
    retainedData.pendingPublishPulseCount = 0;
    retainedData.pendingPublishPulseTimes.fill(INVALID_TIME);
    retainedData.pulseTimes.clear(); // equivalent to CircularBuffer constructor

    // If you add new retained data above, be sure to add
    // an equivalent initializer here.

    retainedData.magic = RETAINED_DATA_MAGIC;
    retainedData.size = sizeof(retainedData);
    retainedData.dataLayoutVersion = retainedData.CURRENT_DATA_LAYOUT_VERSION;
    return false;
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
            retainedData.currentPulseCount += 1;
            pulsesToSignal += 1;
            if (Time.isValid()) {
                retainedData.pulseTimes.push(Time.now());
            }
        }
    }
}


// convert a std::chrono::duration to a time32_t
// timestamp with the same units as Time.now().
inline time32_t asTime32(std::chrono::seconds duration) {
    return duration.count();
}

// Return Time.now() without blocking or cloud connection.
// Enables invalid time LED signal if RTC has gone invalid.
// (Do not call from ISRs.)
time32_t nowTime(time32_t resultIfInvalid = INVALID_TIME) {
    bool isValid = Time.isValid();
    if (isValid != !ledSignalTimeInvalid.isActive()) {
        ledSignalTimeInvalid.setActive(!isValid);
    }
    return isValid ? Time.now() : resultIfInvalid;
}


inline bool hasPendingPublish() {
    return pendingPublishTime != INVALID_TIME;
}

time32_t calcNextPublishTime() {
    // Return timestamp for next desired publish, or 0 for publish immediately.
    time32_t nextPublishTime;

    if (publishImmediately || hasPendingPublish()) {
        nextPublishTime = 0;
    } else {
        // Publish when pulses to report, or at heartbeat if sooner
        nextPublishTime = lastPublishTime + asTime32(PUBLISH_HEARTBEAT_INTERVAL);
        ATOMIC_BLOCK() {
            if (!pulseTimes.isEmpty()) {
                if (pulseTimes.isFull() || pulseTimes.size() >= PUBLISH_MAX_PULSE_TIMES) {
                    // Too many pulseTimes; publish immediately
                    nextPublishTime = 0;
                } else {
                    // Publish accumulated data after in-use interval
                    nextPublishTime = std::min(
                        pulseTimes.first() + asTime32(PUBLISH_IN_USE_INTERVAL),
                        nextPublishTime
                    );
                }
            }
        }
    }

    return nextPublishTime;
}


bool inNetworkProblemDelay() {
    return networkProblemRetryDelay > 0;
}

void onPublishSuccess() {
    ledSignalNetworkProblem.setActive(false);
    networkProblemRetryDelay = 0;
    // Publish at most every 5 seconds (e.g., when recovering after network outage)
    earliestNextPublishTime = nowTime() + asTime32(PUBLISH_MIN_INTERVAL);
}

void onPublishFailure() {
    ledSignalNetworkProblem.setActive(true);
    // Increase delay: 1 minute - 4 hours, with exponential backoff on repeated failures.
    networkProblemRetryDelay = constrain(
        networkProblemRetryDelay * 2,
        asTime32(NETWORK_PROBLEM_INITIAL_DELAY),
        asTime32(NETWORK_PROBLEM_MAX_DELAY));
    earliestNextPublishTime = nowTime() + networkProblemRetryDelay;
}


void publishData() {

    // Collect metering data (unless previous data still pending)
    if (!hasPendingPublish()) {
        // This is the "reliable message delivery" portion of the data.
        // Once captured, we will keep trying to publish it until successful.
        // (Other data--like device battery level--is updated on each publish
        // attempt, because we don't need reliable delivery for it.)
        ATOMIC_BLOCK() {
            retainedData.pendingPublishTime = nowTime();
            retainedData.pendingPublishPulseCount = currentPulseCount;
            // Move pulseTimes for this publish into pendingPublishPulseTimes
            for (auto& pendingPulseTime: retainedData.pendingPublishPulseTimes) {
                if (pulseTimes.isEmpty() || pulseTimes.first() > pendingPublishTime) {
                    pendingPulseTime = INVALID_TIME;
                    break;
                }
                pendingPulseTime = retainedData.pulseTimes.shift();
            }
            publishImmediately = false;
        }
    }

    if (nowTime() < earliestNextPublishTime) {
        // Try again later. (Delay for burst control or connectivity issues.)
        return;
    }

    // Connect to network
    if (!WiFi.ready()) {
        WiFi.connect();
        const std::chrono::milliseconds timeout(NETWORK_CONNECT_TIMEOUT);
        if (!waitFor(WiFi.ready, timeout.count())) {
            onPublishFailure();
            return;
        }
    }

    // Connect to cloud
    if (!Particle.connected()) {
        Particle.connect();
        const std::chrono::milliseconds timeout(CLOUD_CONNECT_TIMEOUT);
        if (!waitFor(Particle.connected, timeout.count())) {
            onPublishFailure();
            return;
        }
    }

    // Capture current device status
    WiFiSignal signal = WiFi.RSSI();  // only valid when WiFi on
    float wifiRSSI = signal.getStrengthValue(); // dBm [-90, 0]
    float wifiSNR = signal.getQualityValue(); // dB [0, 90]
    float wifiStrength = signal.getStrength(); // % [0, 100]
    float wifiQuality = signal.getQuality(); // % [0, 100]
    float batteryVoltage = batteryMonitor.getVCell(); // V
    float batteryCharge = batteryMonitor.getSoC(); // % [0, 100] nominally, but can report higher

    // Format JSON event data
    static std::array<char, particle::protocol::MAX_EVENT_DATA_LENGTH> dataBuf;
    JSONBufferWriter writer(dataBuf.data(), dataBuf.size() - 1);
    writer.beginObject();
    {
        writer.name("t").value(pendingPublishTime); // timestamp of meter data capture
        writer.name("at").value(nowTime()); // actual now
        writer.name("seq").value(publishCount);
        writer.name("per").value(pendingPublishTime - lastPublishTime);
        writer.name("cur").value(pendingPublishPulseCount);
        writer.name("lst").value(lastPublishPulseCount);
        writer.name("use").value(pendingPublishPulseCount - lastPublishPulseCount);
        writer.name("sig").value(wifiRSSI);
        writer.name("snr").value(wifiSNR);
        writer.name("sgp").value(wifiStrength);
        writer.name("sqp").value(wifiQuality);
        writer.name("btv").value(batteryVoltage);
        writer.name("btp").value(batteryCharge);
        writer.name("pts").beginArray();
        {
            // Encode pulseTimes as deltas from previous values.
            // First pulseTime is encoded as delta from last publish.
            time32_t previousTime = lastPublishTime;
            for (const auto& pulseTime: pendingPublishPulseTimes) {
                if (pulseTime == INVALID_TIME) {
                    break;
                }
                writer.value(pulseTime - previousTime);
                previousTime = pulseTime;
            }
        }
        writer.endArray();
        writer.name("v").value(WATERBOT_VERSION);
    }
    writer.endObject();
    writer.buffer()[std::min(writer.bufferSize(), writer.dataSize())] = '\0';
    // assert(writer.dataSize() < writer.bufferSize()); // ???

    // Publish the event
    if (Particle.publish(EVENT_DATA, dataBuf.data(), WITH_ACK)) {
        ATOMIC_BLOCK() {
            retainedData.lastPublishTime = pendingPublishTime;
            retainedData.lastPublishPulseCount = pendingPublishPulseCount;
            retainedData.publishCount += 1;
            retainedData.pendingPublishTime = INVALID_TIME; // no longer pending
        }
        onPublishSuccess();
    } else {
        onPublishFailure();
    }
}


// Cloud function: arg int newPulseCount
int setReading(String args) {
    long newPulseCount = args.toInt();
    if (newPulseCount < 0 || (newPulseCount == 0 && !args.equals("0"))) {
        return -1;
    }

    ATOMIC_BLOCK() {
        retainedData.currentPulseCount = newPulseCount;
        retainedData.pulseTimes.clear();
        publishImmediately = true;
    }
    return 0;
}

// Cloud function
int sleepNow(String args) {
    stayAwakeUntilTime = 0;
    return 0;
}

// Cloud function
int publishNow(String args) {
    publishImmediately = true;
    return 0;
}

// Cloud function: arg 1=internal, 2=external, anything else=auto
// (Antenna is restored to auto when reset button pressed)
int selectAntenna(String args) {
    WLanSelectAntenna_TypeDef antennaType;
    switch (args.toInt()) {
        case 1:
            antennaType = ANT_INTERNAL;
            break;
        case 2:
            antennaType = ANT_EXTERNAL;
            break;
        default:
            antennaType = ANT_AUTO;
            break;
    }
    WiFi.selectAntenna(antennaType);
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

    time32_t now = nowTime();
    if (now < stayAwakeUntilTime) {
        return 0; // stay awake after reset
    }

    // Sleep until time for next publish
    time32_t nextPublishTime = calcNextPublishTime();
    time32_t sleepTime = std::max(nextPublishTime, earliestNextPublishTime) - now;
    return sleepTime < asTime32(MIN_SLEEP_INTERVAL) ? 0 : sleepTime;
}

void disconnectCleanly() {
    // Disconnect from Particle Cloud and turn off WiFi power cleanly.
    Particle.disconnect();  // relies on CloudDisconnectOptions.graceful (see setup)
    waitUntil(Particle.disconnected); // uses CloudDisconnectOptions.timeout (see setup)
    WiFi.off();
}


void sleepDevice(time32_t sleepSecs) {
    // Enter ultra low power mode (after finishing any cloud communication),
    // waking on PIN_PULSE_SWITCH or after sleepSecs secs.
    const std::chrono::seconds sleepDuration(sleepSecs);
    System.sleep(
        SystemSleepConfiguration()
            .mode(SystemSleepMode::ULTRA_LOW_POWER)
            .gpio(PIN_PULSE_SWITCH, FALLING)
            .duration(sleepDuration)
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
    validateRetainedData();

    pinMode(PIN_LED_SIGNAL, OUTPUT);
    digitalWrite(PIN_LED_SIGNAL, LOW);

    pinMode(PIN_PULSE_SWITCH, INPUT_PULLUP);
    attachInterrupt(PIN_PULSE_SWITCH, pulseISR, FALLING);

    if (!pulseSignalThread) {
        pulseSignalThread = new Thread(
            "pulseSignal",
            displayPulseSignals,
            OS_THREAD_PRIORITY_DEFAULT,
            256U // only need a tiny stack
        );
    }

    batteryMonitor.begin();
    if (System.resetReason() == RESET_REASON_POWER_DOWN) {
        batteryMonitor.quickStart();
    }

    Particle.function(FUNC_SET_READING, setReading);
    Particle.function(FUNC_PUBLISH_NOW, publishNow);
    Particle.function(FUNC_SLEEP_NOW, sleepNow);
    Particle.function(FUNC_SELECT_ANTENNA, selectAntenna);

    if (System.resetReason() == RESET_REASON_PIN_RESET) {
        WiFi.selectAntenna(ANT_AUTO);
    }

    Particle.setDisconnectOptions(
        CloudDisconnectOptions()
            .graceful(true) // required for disconnectCleanly
            .timeout(CLOUD_DISCONNECT_TIMEOUT)
    );

    Particle.connect();
    waitUntil(Particle.connected);
    ledSignalNetworkProblem.setActive(false);

    // Most of our logic depends on valid RTC.
    // If we lost track of time while powered down, restore it now.
    if (!Time.isValid()) {
        Particle.syncTime();
        waitUntil(Particle.syncTimeDone);
        ledSignalTimeInvalid.setActive(false);
    }

    if (lastPublishTime == INVALID_TIME) {
        // If we don't know lastPublishTime (first run, retainedData layout change),
        // initialize it to power-up time so next reported usageInterval is reasonable.
        retainedData.lastPublishTime = nowTime() - (millis() / 1000);
    }

    if (System.resetReason() == RESET_REASON_PIN_RESET) {
        stayAwakeUntilTime = nowTime() + asTime32(RESET_STAY_AWAKE_INTERVAL);
    }
}


void loop() {
    // publish
    if (nowTime() >= calcNextPublishTime()) {
        publishData();
    }

    // sleep if appropriate
    time32_t sleepTime = calcSleepTime();
    if (sleepTime > 0) {
        disconnectCleanly();
        sleepTime = calcSleepTime();  // might have changed while waiting for disconnect
        if (sleepTime > 0) {
            sleepDevice(sleepTime);
        }
    }

    // wait a little
    delay(50ms);
}
