// sketch.js — Full-canvas flower visualizer (no layout logic)

// ========== Configuration ==========
const CONFIG = {
  display: {
    useFullscreen: false,
    fixedWidth: 1920,
    fixedHeight: 1080,
  },
  timing: {
    updateHz: 1,
    activationDelayMs: 0,
    deactivationDelayMs: 300,
    fadeInMs: 15,
    fadeOutMs: 90,
  },
  serial: {
    portName: 'COM5',
    baudRate: 9600,
    useMockData: false, // Set to true for testing without Arduino
  },
  mock: {
    coveredProbability: 0.45,
  }
};

// ========== State Management ==========
class FlowerState {
  constructor() {
    this.analogVals = new Array(5).fill(0);
    this.digitalVals = new Array(5).fill(0);
    this.visibleState = new Array(5).fill(false);
    this.alphas = new Array(5).fill(0);
    this.nextUpdateAt = 0;
  }
}

class Sensor {
  constructor() {
    this.pending = null;
    this.pendingStart = 0;
  }
  reset() {
    this.pending = null;
    this.pendingStart = 0;
  }
}

// ========== Global Variables ==========
const state = new FlowerState();
const sensors = Array.from({ length: 5 }, () => new Sensor());

let imgs = [];
let woodBg = null;
let serial; // Serial port object
let serialConnected = false;

// ========== Asset Loading ==========
function preload() {
  loadFlowerImages();
  loadBackgroundImage();
}

function loadFlowerImages() {
  for (let i = 0; i < 5; i++) {
    const path = `flower-images/Fase${i}.png`;
    imgs[i] = loadImage(
      path,
      () => console.log(`✓ Loaded ${path}`),
      () => {
        console.warn(`⚠️ Failed to load ${path}`);
        imgs[i] = null;
      }
    );
  }
}

function loadBackgroundImage() {
  const path = 'flower-images/wood.png';
  woodBg = loadImage(
    path,
    () => console.log(`✓ Loaded ${path}`),
    () => {
      console.warn(`⚠️ Failed to load ${path}`);
      woodBg = null;
    }
  );
}

// ========== Setup & Resize ==========
function setup() {
  const { useFullscreen, fixedWidth, fixedHeight } = CONFIG.display;

  if (useFullscreen) {
    createCanvas(windowWidth, windowHeight);
  } else {
    createCanvas(fixedWidth, fixedHeight);
  }

  textFont('monospace');
  textSize(18);

  console.log('🌸 Flower Visualizer (full-canvas) initialized');

  // Initialize serial connection
  if (!CONFIG.serial.useMockData) {
    initSerial();
  } else {
    console.log('📊 Using mock data mode');
  }
}

function initSerial() {
  serial = new p5.SerialPort();

  serial.on('connected', serverConnected);
  serial.on('list', gotList);
  serial.on('data', gotData);
  serial.on('error', gotError);
  serial.on('open', portOpen);
  serial.on('close', portClose);

  // List available ports
  serial.list();

  // Open the port
  serial.open(CONFIG.serial.portName, { baudRate: CONFIG.serial.baudRate });
}

function windowResized() {
  if (CONFIG.display.useFullscreen) {
    resizeCanvas(windowWidth, windowHeight);
  }
}

// ========== Main Draw Loop ==========
function draw() {
  drawBackground();
  updateSensorData();
  updateAlphas();
  drawFlowersFullCanvas();
}

function drawBackground() {
  if (!woodBg) {
    background(40);
    return;
  }

  const canvasAR = width / height;
  const imgAR = woodBg.width / woodBg.height;
  let dw, dh, dx, dy;

  if (imgAR > canvasAR) {
    // Image is wider - fit to height
    dh = height;
    dw = imgAR * dh;
    dx = (width - dw) / 2;
    dy = 0;
  } else {
    // Image is taller - fit to width
    dw = width;
    dh = dw / imgAR;
    dx = 0;
    dy = (height - dh) / 2;
  }

  image(woodBg, dx, dy, dw, dh);
}

function updateSensorData() {
  const now = millis();

  // Only use mock data generation when in mock mode
  if (CONFIG.serial.useMockData && now >= state.nextUpdateAt) {
    const line = generateMockArduinoLine();
    processArduinoData(line);
    state.nextUpdateAt = now + 1000 / CONFIG.timing.updateHz;
  }

  // Real serial data is processed via gotData() callback
}

function updateAlphas() {
  const dt = deltaTime;

  for (let i = 0; i < 5; i++) {
    const targetAlpha = state.visibleState[i] ? 255 : 0;
    const tau = state.visibleState[i]
      ? CONFIG.timing.fadeInMs
      : CONFIG.timing.fadeOutMs;

    state.alphas[i] = approachExp(state.alphas[i], targetAlpha, dt, tau);
  }
}

// ========== Flower Rendering (Full Canvas) ==========
function drawFlowersFullCanvas() {
  // Draw in index order; later images will appear "on top"
  // PNG transparency will allow lower layers to show through.
  for (let i = 0; i < 5; i++) {
    if (!imgs[i]) continue;
    const alpha = constrain(state.alphas[i], 0, 255);
    if (alpha <= 0.5) continue; // Skip invisible

    push();
    imageMode(CORNER);
    tint(255, alpha);
    image(imgs[i], 0, 0, width, height); // Fill the entire canvas
    pop();
  }
}

// ========== Debounce Logic ==========
function applyDebounceRebounce(index, bitIsOne) {
  const now = millis();
  const isVisible = state.visibleState[index];
  const sensor = sensors[index];
  const { activationDelayMs, deactivationDelayMs } = CONFIG.timing;

  if (bitIsOne) {
    // Signal is HIGH
    if (isVisible) {
      sensor.reset();
    } else if (sensor.pending !== 'on') {
      sensor.pending = 'on';
      sensor.pendingStart = now;
    } else if (now - sensor.pendingStart >= activationDelayMs) {
      state.visibleState[index] = true;
      sensor.reset();
    }
  } else {
    // Signal is LOW
    if (!isVisible) {
      sensor.reset();
    } else if (sensor.pending !== 'off') {
      sensor.pending = 'off';
      sensor.pendingStart = now;
    } else if (now - sensor.pendingStart >= deactivationDelayMs) {
      state.visibleState[index] = false;
      sensor.reset();
    }
  }
}

// ========== Utility Functions ==========
function approachExp(current, target, dtMs, tauMs) {
  if (tauMs <= 0) return target;
  const k = Math.exp(-dtMs / tauMs);
  return target + (current - target) * k;
}

function generateMockArduinoLine() {
  const analog = Array.from({ length: 5 }, () => int(random(0, 1024)));
  const digital = Array.from({ length: 5 }, () =>
    random() < CONFIG.mock.coveredProbability ? 1 : 0
  );
  return analog.concat(digital);
}

function processArduinoData(line) {
  state.analogVals = line.slice(0, 5);
  state.digitalVals = line.slice(5, 10);

  console.log(`[${line.join(",")}]`);

  for (let i = 0; i < 5; i++) {
    applyDebounceRebounce(i, state.digitalVals[i] === 1);
  }
}

// ========== Serial Port Callbacks ==========
function serverConnected() {
  console.log('✓ Connected to serial server');
}

function portOpen() {
  console.log('✓ Serial port opened:', CONFIG.serial.portName);
  serialConnected = true;
}

function portClose() {
  console.log('✗ Serial port closed');
  serialConnected = false;
}

function gotList(thelist) {
  console.log('📋 Available serial ports:');
  for (let i = 0; i < thelist.length; i++) {
    console.log(`  ${i}: ${thelist[i]}`);
  }
}

function gotData() {
  const currentString = serial.readLine();

  if (!currentString) return;

  trim(currentString);

  if (!currentString) return;

  console.log('📥 Received:', currentString);

  // Expected format: analog0..4,digital0..4
  const values = currentString.split(',').map(val => parseInt(val.trim(), 10));

  if (values.length === 10 && values.every(v => !Number.isNaN(v))) {
    processArduinoData(values);
  } else {
    console.warn('⚠️ Invalid data format. Expected 10 integers, got:', values.length, values);
  }
}

function gotError(theerror) {
  console.error('❌ Serial error:', theerror);
  serialConnected = false;
}
