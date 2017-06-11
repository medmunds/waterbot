// ------------
// Pulse counter
// ------------

#include <application.h>

// Behavior constants

const int SIGNAL_BLINK_TIME_ON = 350; // msec
const int SIGNAL_BLINK_TIME_OFF = 150;


// Hardware constants

const int PIN_PULSE_SWITCH = WKP;
const int PIN_LED_SIGNAL = D7; // Built-in blue LED near D7


// Stored data

unsigned int pulseCount = 0;
unsigned int pulsesToSignal = 0;


void handlePulse() {
    // TODO: this will also be called for timeout wakeup from deep sleep.
    // To disambiguate, need to connect switch to additional pin and read that status here.
    // https://community.particle.io/t/photon-wkp-pin-interupt-flag-question/14280/3
    pulseCount += 1;
    pulsesToSignal += 1;
}


void setup() {
    pinMode(PIN_LED_SIGNAL, OUTPUT);
    digitalWrite(PIN_LED_SIGNAL, LOW);

    pinMode(PIN_PULSE_SWITCH, INPUT_PULLDOWN);  // system.sleep also sets this
    attachInterrupt(PIN_PULSE_SWITCH, handlePulse, RISING);  // deep sleep requires rising edge
}


void loop() {
    while (pulsesToSignal > 0) {
        pulsesToSignal -= 1;
        digitalWrite(PIN_LED_SIGNAL, HIGH);
        delay(SIGNAL_BLINK_TIME_ON);
        digitalWrite(PIN_LED_SIGNAL, LOW);
        delay(SIGNAL_BLINK_TIME_OFF);
    }
}
