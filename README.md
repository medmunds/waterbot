# Waterbot: water meter on the web

This (work-in-progress) project provides data collection and reporting for a pulse-output water meter.
It's currently used at [Permaculture San Francisco's][permaculture-sf] 18th and Rhode Island Garden:
here's the [latest data][production-waterbot].

[permaculture-sf]: http://www.permaculture-sf.org
[production-waterbot]: https://waterbot.twistymaze.com


## What's involved

Skeletal docs follow; better info to come later.
Feel free to contact Mike (email is in my profile) with any questions.


### Hardware

You'll need:

* A pulse-output water meter: we're using this *very reasonably priced* stainless steel
  model from [EKM Metering][water-meter]
* A Particle [Photon][photon] to sense the meter pulses and connect over WiFi to report usage
* A Particle [Particle Power Shield][power-shield] to charge a LiPo battery that runs the Photon
* A waterproof case to hold the electronics,
  with a clear cover so you can see the various LEDs for troubleshooting
* A solar cell that provides DC power for the Power Shield: we're piggy-backing off a 24V
  one the garden was already using for its pond pump

You'll also need access to a WiFi network. We have plenty of those in SF.
(Particle also makes a similar "Electron" board that uses cellular instead
of WiFi; you could probably adapt this project without much effort.)

Wiring (the Fritzing schematic is slightly outdated):
* Connect the Photon's WKP and 3V3 pins directly to the meter's pulse output
* Connect the solar cell to the Power Shield's DC input screw terminals
* (Optional, but recommended:) Connect the Photon's GND and RST pins to a pushbutton
  you can access relatively easily -- this lets you wake up the Photon for maintenance

[water-meter]: http://www.ekmmetering.com/3-4-water-meter-stainless-steel-pulse-output.html
[photon]: https://www.particle.io/products/hardware/photon-wifi-dev-kit
[power-shield]: https://docs.particle.io/datasheets/particle-shields/#power-shield


### Firmware

The [waterbot firmware](firmware/) is loosely based on [this similar project][water-usage-monitor].

You should be able to build and flash it with the particle-cli tools or Particle's desktop IDE.

The firmware publishes events to the Particle Cloud:

* Whenever a meter pulse is detected, though at most once every 5 minutes.
  It will group together multiple pulses in a 5-minute period.

* At least once every 4 hours, even if no meter pulses are detected.

Once running the waterbot firmware, your Photon will try to enter deep sleep as often as possible
to conserve battery. The reset button will wake it up for 5 minutes so you can perform maintenance.

There are constants near the top of the [source](firmware/src/waterbot.cpp)
to change the various timings.

[water-usage-monitor]: https://community.particle.io/t/water-usage-monitor/16187


### Server

The [waterbot server](server/) component runs "serverless" in the Google Cloud Platform,
collecting data in BigQuery. There are two Cloud Function endpoints:

* `dataCapture` receives events from the Particle Cloud via a Pub/Sub Topic
  and stores the data in Google BigQuery

* `report` summarizes the data from BigQuery for use by the web client


To deploy your own (and yes, this all needs to get cleaned up and automated):

1. Create a Google Cloud Platform project and set up your Particle Cloud to publish
   to a Pub/Sub Topic in it. Follow [Particle's GCP Integration][particle-google-pubsub] docs.

2. Create a BigQuery table using this [schema](server/schema.json). Optionally populate it
   with any historic usage data.

3. Edit the [server config](server/src/config.ts) to match your Google Cloud Platform project,
   and then deploy the two Cloud Functions using the comments at the top of each .js file.

[particle-google-pubsub]: https://docs.particle.io/tutorials/integrations/google-cloud-platform/


### Web client

The [waterbot client](client/) component runs in a web browser and generates nice charts and scorecards
from the server reports. Here's [a live example][production-waterbot].

Most of the [client config](client/src/config.js) is separated out, but there are probably
some hard-coded links and references to Permaculture SF scattered around the code.

The client is (currently) a create-react-app project.
Build it with `yarn build`.

The resulting build is a static site and can be hosted just about anywhere.
(We're currently using [Netlify][netlify] for super-simple continuous deployment and easy https.)

[netlify]: https://www.netlify.com/
