#include <FastLED.h>

#define LED_PIN     6
#define LED_TYPE    WS2812B
#define COLOR_ORDER GRB
#define NUM_LEDS    300       // adjust to your strip length
#define BRIGHTNESS  150       // max 255

CRGB leds[NUM_LEDS];

// === Breathing control variable ===
int BREATH_SPEED = 20;  // smaller = slower breathing, larger = faster

void setup() {
  delay(300); // power-up safety delay
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS)
         .setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(BRIGHTNESS);
}

void loop() {
  // Calculate a breathing brightness using a sine wave
  // "beatsin8" returns 0-255 with a sine shape
  uint8_t breath = beatsin8(BREATH_SPEED, 0, 255);  

  // Shift LEDs forward (like a pulse traveling)
  for (int i = NUM_LEDS - 1; i > 0; i--) {
    leds[i] = leds[i - 1];
  }

  // Insert new "head" pixel at start with breathing green
  leds[0] = CRGB(0, breath, 0);

  FastLED.show();
  delay(20); // step speed (lower = faster travel)
}
