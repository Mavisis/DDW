#include <FastLED.h>

/* ================= WS2812B STRIP ================= */
#define LED_PIN       5
#define LED_TYPE      WS2812B
#define COLOR_ORDER   GRB
#define NUM_LEDS      300       // total LEDs             
#define BRIGHTNESS    200       // overall cap (0-255)    

CRGB leds[NUM_LEDS];

/* ====== Segments ====== */
const int SEG_COUNT = 5;
const int SEG_LEN   = 60;       // 300 / 5 = 60

// breathing control: smaller = slower, larger = faster
int BREATH_SPEED = 20;

/* ================= ANALOG SENSORS (original) ================= */
const int NUM_SENSORS = 5;
const int pins[NUM_SENSORS] = {A0, A1, A2, A3, A4};

// smoothing
const int N = 8;
static long acc[NUM_SENSORS];
static int  buf[NUM_SENSORS][N];
static int  idx = 0;

// hysteresis
const int TH_LOW  = 380;
const int TH_HIGH = 420;
static int state[NUM_SENSORS]; // 0=covered, 1=not-covered

/* ================= HELPERS ================= */
inline void fillSegment(int segIdx, const CRGB& color) {
  int start = segIdx * SEG_LEN;
  int endEx = start + SEG_LEN;      // exclusive end
  for (int i = start; i < endEx; i++) {
    leds[i] = color;
  }
}

/* ================= SETUP ================= */
void setup() {
  // LED setup
  delay(300);
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS)
         .setCorrection(TypicalLEDStrip);
  FastLED.setBrightness(BRIGHTNESS);
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();

  // Sensors (original behavior)
  Serial.begin(9600);  // keep 9600 for p5
  analogReference(DEFAULT);

  // init buffers/state
  for (int i = 0; i < NUM_SENSORS; i++) {
    int v = analogRead(pins[i]);
    for (int k = 0; k < N; k++) buf[i][k] = v;
    acc[i] = (long)v * N;
    state[i] = (v >= TH_HIGH) ? 1 : 0;
  }
}

/* ================= LOOP ================= */
void loop() {
  /* ---- SENSORS: smoothing and hysteresis (original) ---- */
  for (int i = 0; i < NUM_SENSORS; i++) {
    int raw = analogRead(pins[i]);
    acc[i] -= buf[i][idx];
    buf[i][idx] = raw;
    acc[i] += raw;
  }
  idx = (idx + 1) % N;

  for (int i = 0; i < NUM_SENSORS; i++) {
    int avg = acc[i] / N;
    if (state[i] == 0 && avg >= TH_HIGH) state[i] = 1;       // rising
    else if (state[i] == 1 && avg <= TH_LOW) state[i] = 0;   // falling
  }

  /* ---- LED RENDER: per-segment breathing if covered ---- */
  // one shared breathing value (you can make it per-segment if desired)
  uint8_t breath = beatsin8(BREATH_SPEED, 0, 255);  // 0–255 sine
  // optional minimum so “covered” isn’t completely dark at bottom of the breath
  uint8_t g = qadd8(breath, 10); // adds a small floor (10), capped at 255

  for (int s = 0; s < SEG_COUNT; s++) {
    if (state[s] == 0) {
      // covered -> pulse green
      fillSegment(s, CRGB(0, g, 0));
    } else {
      // not covered -> off
      fillSegment(s, CRGB::Black);
    }
  }

  FastLED.show();

  /* ---- SERIAL OUTPUT (original CSV line) ---- */
  Serial.print(state[0]); Serial.print(',');
  Serial.print(state[1]); Serial.print(',');
  Serial.print(state[2]); Serial.print(',');
  Serial.print(state[3]); Serial.print(',');
  Serial.println(state[4]);

  delay(30); // ~33 Hz update, matches your original
}
