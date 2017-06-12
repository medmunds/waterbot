// ------------
// Pulse counter
// ------------

#include <Particle.h>

// Some helpful Time.now unit conversions:
#define SECONDS 1
#define MINUTES (60 * SECONDS)
#define HOURS (60 * MINUTES)


// Behavior constants

const unsigned long PUBLISH_AT_MOST_EVERY = 15 * SECONDS;  // 15 * MINUTES;
const unsigned long PUBLISH_AT_LEAST_EVERY = 2 * MINUTES;  // 24 * HOURS; // (heartbeat)

const unsigned long SIGNAL_BLINK_ON_MSEC = 350;
const unsigned long SIGNAL_BLINK_OFF_MSEC = 150;


// Hardware constants

const int PIN_PULSE_SWITCH = D2;
const int PIN_LED_SIGNAL = D7; // Built-in blue LED near D7


// Event constants

const char* EVENT_DATA = "data";

const char* TRIGGER_INIT = "init";
const char* TRIGGER_IN_USE = "inUse";
const char* TRIGGER_HEARTBEAT = "heartbeat";


// Stored data

unsigned long pulseCount = 0;
unsigned long pulsesToSignal = 0;

unsigned long lastPublishTime = 0;
unsigned long lastPublishCount = pulseCount;


void handlePulse() {
    // Called for both pulse interrupts and timeout wakeup from deep sleep.
    // Check the pulse pin status to disambiguate.
    // https://community.particle.io/t/photon-wkp-pin-interupt-flag-question/14280/3
    if (digitalRead(PIN_PULSE_SWITCH) == HIGH) {
        pulseCount += 1;
        pulsesToSignal += 1;
    }
}


void publishData(const char* trigger) {
    unsigned long now = Time.now();
    unsigned long currentPulseCount = pulseCount;  // capture in case we're interrupted
    int rssi = WiFi.RSSI();  // report whenever we're publishing

    // format all our vars into JSON; note Particle allows 255 chars max
    String data = String::format(
        "{\"event\": \"%s\", \"meterReading\": %u, \"signalStrength\": %d}",
        trigger, currentPulseCount, rssi);
    if (Particle.publish(EVENT_DATA, data)) {
        // maybe use WITH_ACK flag to delay until confirmed?
        lastPublishTime = now;
        lastPublishCount = currentPulseCount;
    }
}


void setup() {
    pinMode(PIN_LED_SIGNAL, OUTPUT);
    digitalWrite(PIN_LED_SIGNAL, LOW);

    pinMode(PIN_PULSE_SWITCH, INPUT_PULLDOWN);  // system.sleep sets this for WKP
    attachInterrupt(PIN_PULSE_SWITCH, handlePulse, RISING);  // deep sleep requires rising edge

    // DEBUG:
    Particle.variable("pulseCount", pulseCount);
}


void loop() {
    // publish
    if (Time.isValid()) {
        unsigned long now = Time.now();
        if (lastPublishTime == 0) {
            publishData(TRIGGER_INIT);
        } else if (now >= lastPublishTime + PUBLISH_AT_MOST_EVERY
                   && pulseCount > lastPublishCount) {
            publishData(TRIGGER_IN_USE);
        } else if (now >= lastPublishTime + PUBLISH_AT_LEAST_EVERY) {
            publishData(TRIGGER_HEARTBEAT);
        }
    }

    // signal
    if (pulsesToSignal > 0) {
        pulsesToSignal -= 1;
        digitalWrite(PIN_LED_SIGNAL, HIGH);
        delay(SIGNAL_BLINK_ON_MSEC);
        digitalWrite(PIN_LED_SIGNAL, LOW);
        delay(SIGNAL_BLINK_OFF_MSEC);
    }
}
