let serial;
let latestData = "waiting for data";

let rawValues = [1, 1, 1, 1, 1];
let displayValues = [1, 1, 1, 1, 1];

const lastActive = [0, 0, 0, 0, 0]; // timestamp (ms) of last time each sensor went 0
const fadeDuration = 10000;         // 10 seconds

function setup() {
  createCanvas(windowWidth, windowHeight);

  serial = new p5.SerialPort();
  serial.list();
  serial.open('COM5');

  serial.on('connected', serverConnected);
  serial.on('list', gotList);
  serial.on('data', gotData);
  serial.on('error', gotError);
  serial.on('open', gotOpen);
  serial.on('close', gotClose);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function serverConnected() { print("Connected to Server"); }
function gotList(thelist) { for (let i=0; i<thelist.length; i++) print(i + " " + thelist[i]); }
function gotOpen() { print("Serial Port is Open"); }
function gotClose() { print("Serial Port is Closed"); latestData = "Serial Port is Closed"; }
function gotError(theerror) { print(theerror); }

function gotData() {
  let currentString = serial.readLine();
  if (!currentString) return;
  currentString = trim(currentString);
  if (currentString.length === 0) return;

  try {
    const normalized = currentString.replace(/[\[\]\s]/g, "");
    const parts = normalized.split(",").map(v => int(v));

    if (parts.length === 5 && parts.every(v => v === 0 || v === 1)) {
      rawValues = parts.slice();
      applyCascade();
      latestData = currentString;
    }
  } catch (err) {
    console.error("Parse error:", err, "on:", currentString);
  }
}

function applyCascade() {
  displayValues = rawValues.slice();
  const firstZeroIdx = rawValues.findIndex(v => v === 0);

  if (firstZeroIdx !== -1) {
    for (let i = 0; i <= firstZeroIdx; i++) {
      displayValues[i] = 0;
    }
  }
}

function draw() {
  background(220);

  const n = displayValues.length;
  const margin = 20;
  const gap = 10;
  const totalGap = gap * (n - 1);
  const boxW = (width - margin * 2 - totalGap) / n;
  const boxH = min(height * 0.6, boxW * 1.2);
  const y = (height - boxH) / 2;

  const now = millis();

  stroke(100);
  strokeWeight(2);

  for (let i = 0; i < n; i++) {
    if (displayValues[i] === 0) {
      // Update last active time
      lastActive[i] = now;
    }

    // Time since last active
    const elapsed = now - lastActive[i];

    // Compute brightness: 0 = black, 255 = white
    let brightness = 255;
    if (elapsed < fadeDuration) {
      // fade linearly from 0 → 255 over fadeDuration
      brightness = map(elapsed, 0, fadeDuration, 0, 255);
    }

    fill(brightness);
    const x = margin + i * (boxW + gap);
    rect(x, y, boxW, boxH, 8);
  }

  // Debug info
  noStroke();
  fill(0);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Raw:     " + rawValues.join(","), margin, 10);
  text("Display: " + displayValues.join(","), margin, 30);
  text("Latest:  " + latestData, margin, 50);
}
