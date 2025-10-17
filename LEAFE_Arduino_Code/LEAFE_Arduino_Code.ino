// ==== Memory-Optimized Interactive Handrail ====
// Reduced from 2164 to ~1400 bytes RAM usage
#include <FastLED.h>

// ---------- LED STRIP CONFIG ----------
#define LED_PIN 5
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
#define NUM_LEDS 300
#define GLOBAL_BRIGHTNESS 255

CRGB leds[NUM_LEDS];  // 900 bytes (unavoidable)

// ---------- Sections ----------
#define SMOOTH_END 85
#define TRANS_START 86
#define TRANS_END 205
#define ROUGH_END 299
const uint16_t PERM_GREEN_LEDS[] = { 92, 111, 136, 161, 186 };
#define NUM_PERM_GREEN_LEDS (sizeof(PERM_GREEN_LEDS) / sizeof(PERM_GREEN_LEDS[0]))

// ---------- Sensors ----------
#define NSENS 5
const uint8_t LDR_PINS[NSENS] PROGMEM = { A0, A1, A2, A3, A4 };
int ldrValues[NSENS];

#define TH_LOW 400
#define TH_HIGH 450
uint8_t sensCovered = 0;  // Bitfield instead of array (5 bytes -> 1 byte)

uint8_t sensCenterIdx[NSENS];  // 5 bytes

// ---------- Timing ----------
#define SAMPLE_INTERVAL_MS 50
unsigned long lastSampleMs = 0;

// ---------- Breathing ----------
#define BREATHE_PERIOD_MS 3000
#define BREATHE_MAX_V 124
#define GREEN_HUE 96
#define WHITE_V 124

inline uint8_t breathingSat(unsigned long t) {
  uint16_t phase = (t % BREATHE_PERIOD_MS) * 255 / BREATHE_PERIOD_MS;
  int16_t s = 255 - abs((int16_t)phase * 2 - 255);
  return s < 0 ? 0 : (s > 255 ? 255 : s);
}

void paintBreathing(uint8_t sat) {
  CHSV c(GREEN_HUE, sat, BREATHE_MAX_V);
  for (uint8_t i = 0; i <= SMOOTH_END; i++) leds[i] = c;
}

void paintWhiteBase() {
  CHSV w(0, 0, WHITE_V);
  for (uint16_t i = TRANS_START; i <= ROUGH_END; i++) leds[i] = w;
}

// ---------- Pulses (REDUCED from 64 to 16) ----------
struct Pulse {
  float pos;
  uint8_t age;  // frames instead of millis (1 byte vs 4)
  bool alive;
};

#define MAX_PULSES 16  // Reduced from 64 (saves ~600 bytes!)
Pulse pulses[MAX_PULSES];

#define PULSE_HEAD_LEN 8
#define PULSE_TAIL_LEN 24
#define PULSE_HEAD_V 170
#define PULSE_TAIL_V 124
#define PULSE_SPEED_PER_FRAME 1.6f  // ~80 LEDs/sec at 50fps

void spawnPulse(float startPos) {
  for (uint8_t i = 0; i < MAX_PULSES; i++) {
    if (!pulses[i].alive) {
      pulses[i].alive = true;
      pulses[i].pos = startPos;
      pulses[i].age = 0;
      return;
    }
  }
  // Overwrite oldest
  uint8_t oldest = 0, maxAge = 0;
  for (uint8_t i = 0; i < MAX_PULSES; i++) {
    if (pulses[i].age > maxAge) {
      maxAge = pulses[i].age;
      oldest = i;
    }
  }
  pulses[oldest].alive = true;
  pulses[oldest].pos = startPos;
  pulses[oldest].age = 0;
}

void updatePulses() {
  for (uint8_t i = 0; i < MAX_PULSES; i++) {
    if (!pulses[i].alive) continue;
    pulses[i].pos += PULSE_SPEED_PER_FRAME;
    pulses[i].age++;
    if (pulses[i].pos > ROUGH_END + PULSE_TAIL_LEN) {
      pulses[i].alive = false;
    }
  }
}

void renderPulses() {
  for (uint8_t k = 0; k < MAX_PULSES; k++) {
    if (!pulses[k].alive) continue;
    int16_t head = (int16_t)pulses[k].pos;

    // Head
    for (int16_t i = head; i < head + PULSE_HEAD_LEN; i++) {
      if (i >= TRANS_START && i <= ROUGH_END) {
        leds[i] = CHSV(GREEN_HUE, 255, PULSE_HEAD_V);
      }
    }

    // Tail (simplified fade)
    for (uint8_t t = 1; t <= PULSE_TAIL_LEN; t++) {
      int16_t idx = head - t;
      if (idx < TRANS_START) break;
      if (idx > ROUGH_END) continue;
      uint8_t v = PULSE_TAIL_V * (PULSE_TAIL_LEN - t) / PULSE_TAIL_LEN;
      leds[idx] = blend(leds[idx], CHSV(GREEN_HUE, 255, v), 200);
    }
  }
}

// ---------- Burst (compact struct) ----------
struct BurstState {
  uint8_t remaining;
  uint8_t nextFrame;
};
BurstState bursts[NSENS];  // 10 bytes instead of 20

#define BURST_COUNT 5
#define BURST_INTERVAL_FRAMES 25  // ~80ms at 50fps

void startBurst(uint8_t si) {
  bursts[si].remaining = BURST_COUNT;
  bursts[si].nextFrame = 0;
}
void paintPermanentGreen() {
  CHSV greenColor(96, 255, 124);  // Bright green (same hue as breathing)
  for (uint8_t i = 0; i < NUM_PERM_GREEN_LEDS; i++) {
    uint16_t idx = PERM_GREEN_LEDS[i];
    // center
    if (idx >= 0 && idx < NUM_LEDS) {
      leds[idx] = greenColor;
    }
    // one below (idx - 1)
    if ((idx - 1) >= 0 && (idx - 1) < NUM_LEDS) {
      leds[idx - 1] = greenColor;
    }
    // one above (idx + 1)
    if ((idx + 1) >= 0 && (idx + 1) < NUM_LEDS) {
      leds[idx + 1] = greenColor;
    }
  }
}
void tickBursts() {
  for (uint8_t i = 0; i < NSENS; i++) {
    if (bursts[i].remaining == 0) continue;
    if (bursts[i].nextFrame == 0) {
      spawnPulse(sensCenterIdx[i]);
      bursts[i].remaining--;
      bursts[i].nextFrame = BURST_INTERVAL_FRAMES;
    } else {
      bursts[i].nextFrame--;
    }
  }
}

// ---------- Sensor handling ----------
void computeSensorCenters() {
  for (uint8_t i = 0; i < NSENS; i++) {
    sensCenterIdx[i] = TRANS_START + 12 + i * 24;  // Simplified math
  }
}

void sampleLDRs() {
  for (uint8_t i = 0; i < NSENS; i++) {
    ldrValues[i] = analogRead(pgm_read_byte(&LDR_PINS[i]));

    bool wasCovered = sensCovered & (1 << i);
    bool nowCovered = wasCovered ? (ldrValues[i] <= TH_HIGH) : (ldrValues[i] < TH_LOW);

    if (nowCovered) {
      sensCovered |= (1 << i);
      if (!wasCovered) startBurst(i);
    } else {
      sensCovered &= ~(1 << i);
    }
  }
}

// ---------- Setup ----------
void setup() {
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(GLOBAL_BRIGHTNESS);

  computeSensorCenters();
  for (uint8_t i = 0; i < MAX_PULSES; i++) pulses[i].alive = false;
  for (uint8_t i = 0; i < NSENS; i++) bursts[i] = { 0, 0 };

  Serial.begin(115200);
  Serial.println(F("A0,A1,A2,A3,A4,D0,D1,D2,D3,D4"));
}

// ---------- Main Loop ----------
void loop() {
  static unsigned long lastMs = 0;
  unsigned long now = millis();

  // Sample sensors every 50ms
  if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;
    sampleLDRs();

    for (uint8_t i = 0; i < NSENS; i++) {
      Serial.print(ldrValues[i]);  // analog
      Serial.print(',');           // comma after each analog
    }
    // Digitals: 1 = covered, 0 = not covered (using hysteresis-updated state bitfield)
    for (uint8_t i = 0; i < NSENS; i++) {
      uint8_t covered = (sensCovered >> i) & 0x01;
      Serial.print(covered);
      if (i < NSENS - 1) Serial.print(',');
    }
    Serial.println();
  }

  // Render frame
  paintWhiteBase();
  paintBreathing(breathingSat(now));
  tickBursts();
  updatePulses();
  renderPulses();
  paintPermanentGreen();
  FastLED.show();

  lastMs = now;
}