const int NUM_SENSORS = 5;
const int pins[NUM_SENSORS] = {A0, A1, A2, A3, A4};

// ---------- smoothing ----------
const int N = 8;                 // moving average window
static long acc[NUM_SENSORS];    // running sums
static int  buf[NUM_SENSORS][N]; // ring buffers
static int  idx = 0;

// ---------- thresholding (with hysteresis to avoid flicker) ----------
const int TH_LOW  = 380;         // go to 0 if <= TH_LOW
const int TH_HIGH = 420;         // go to 1 if >= TH_HIGH
static int state[NUM_SENSORS];   // 0 = hand-covers, 1 = hand-not-covers

// Toggle this to show human-readable messages on state changes
#define PRINT_STATUS_CHANGES 1   // set to 0 if you only want plotting

void setup() {
  Serial.begin(9600);            // match your Plotter/Monitor baud
  analogReference(DEFAULT);
  // Optional: force a known initial state by reading once
  for (int i = 0; i < NUM_SENSORS; i++) {
    int v = analogRead(pins[i]);
    for (int k = 0; k < N; k++) buf[i][k] = v;
    acc[i] = (long)v * N;
    state[i] = (v >= TH_HIGH) ? 1 : 0;
  }
  delay(100);
}

void loop() {
  // Update moving averages
  for (int i = 0; i < NUM_SENSORS; i++) {
    int raw = analogRead(pins[i]);
    acc[i] -= buf[i][idx];
    buf[i][idx] = raw;
    acc[i] += raw;
  }
  idx = (idx + 1) % N;

  int avg[NUM_SENSORS];
  int dig[NUM_SENSORS];

  // Threshold with hysteresis + detect changes
  for (int i = 0; i < NUM_SENSORS; i++) {
    avg[i] = acc[i] / N;               // smoothed 0..1023

    int prev = state[i];
    if (state[i] == 0 && avg[i] >= TH_HIGH) state[i] = 1;
    else if (state[i] == 1 && avg[i] <= TH_LOW) state[i] = 0;

    dig[i] = state[i];

#if PRINT_STATUS_CHANGES
    if (state[i] != prev) {
      if (state[i] == 0) {
        Serial.print("L"); Serial.print(i); Serial.println(": hand-covers");
      } else {
        Serial.print("L"); Serial.print(i); Serial.println(": hand-not-covers");
      }
    }
#endif
  }

  // ---- SERIAL PLOTTER LINE (tab-separated label:value pairs) ----
  // 5 analog series (A0..A4) + 5 digital series (S0..S4)
  Serial.print("A0:"); Serial.print(avg[0]); Serial.print('\t');
  Serial.print("A1:"); Serial.print(avg[1]); Serial.print('\t');
  Serial.print("A2:"); Serial.print(avg[2]); Serial.print('\t');
  Serial.print("A3:"); Serial.print(avg[3]); Serial.print('\t');
  Serial.print("A4:"); Serial.print(avg[4]); Serial.print('\t');

  Serial.print("S0:"); Serial.print(dig[0]); Serial.print('\t');
  Serial.print("S1:"); Serial.print(dig[1]); Serial.print('\t');
  Serial.print("S2:"); Serial.print(dig[2]); Serial.print('\t');
  Serial.print("S3:"); Serial.print(dig[3]); Serial.print('\t');
  Serial.print("S4:"); Serial.print(dig[4]); Serial.println();

  delay(50); // ~20 Hz update
}
