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
static int state[NUM_SENSORS]; // 0=covers, 1=not-covers

void setup() {
  Serial.begin(9600);  // <— match this in p5
  analogReference(DEFAULT);

  // init buffers/state
  for (int i = 0; i < NUM_SENSORS; i++) {
    int v = analogRead(pins[i]);
    for (int k = 0; k < N; k++) buf[i][k] = v;
    acc[i] = (long)v * N;
    state[i] = (v >= TH_HIGH) ? 1 : 0;
  }
}

void loop() {
  for (int i = 0; i < NUM_SENSORS; i++) {
    int raw = analogRead(pins[i]);
    acc[i] -= buf[i][idx];
    buf[i][idx] = raw;
    acc[i] += raw;
  }
  idx = (idx + 1) % N;

  for (int i = 0; i < NUM_SENSORS; i++) {
    int avg = acc[i] / N;
    if (state[i] == 0 && avg >= TH_HIGH) state[i] = 1;
    else if (state[i] == 1 && avg <= TH_LOW) state[i] = 0;
  }

  // CSV line: S0,S1,S2,S3,S4\n
  Serial.print(state[0]); Serial.print(',');
  Serial.print(state[1]); Serial.print(',');
  Serial.print(state[2]); Serial.print(',');
  Serial.print(state[3]); Serial.print(',');
  Serial.println(state[4]);

  delay(30); // ~33 Hz
}
