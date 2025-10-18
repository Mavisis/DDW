// sketch.js — Enhanced dual-screen flower visualizer with bezel compensation
// Includes: non-scrollable page, fullscreen support, safe edge layout,
// offscreen virtual canvas with bezel "gutter", calibration overlay,
// and preserves all original functionality/configurations.

// ========== Configuration ==========
const CONFIG = {
  display: {
    useFullscreen: true,
    fixedWidth: 1920,
    fixedHeight: 1080,

    // --- NEW: dual-screen settings for demo day ---
    dualScreens: true,      // set true to span two monitors
    leftWidthPx: 1920,      // physical pixel width of LEFT monitor
    rightWidthPx: 1920,     // physical pixel width of RIGHT monitor
    bezelCompPx: 60         // hidden "gutter" width for the physical bezel (tune on-site)
  },
  timing: {
    updateHz: 1,
    activationDelayMs: 120,
    deactivationDelayMs: 150,
    fadeInMs: 700,
    fadeOutMs: 900,
  },
  layout: {
    baseImgHeight: 0.9,
    bottomMargin: 40,
    sideMargin: 40,
    slotFill: 0.92,
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

class LayoutManager {
  constructor() {
    this.slotLeft = 0;
    this.slotWidth = 0;
    this.yBaseline = 0;
    this.targetH = 0;
  }

  compute(canvasWidth, canvasHeight) {
    const { sideMargin, bottomMargin, baseImgHeight } = CONFIG.layout;
    const usableW = Math.max(1, canvasWidth - 2 * sideMargin);
    
    this.slotWidth = usableW / 5;
    this.slotLeft = sideMargin;
    this.yBaseline = canvasHeight - bottomMargin;
    this.targetH = canvasHeight * baseImgHeight;
  }

  getSlotCenter(index) {
    return this.slotLeft + index * this.slotWidth + this.slotWidth / 2;
  }
}

// ========== Global Variables ==========
const state = new FlowerState();
const sensors = Array.from({ length: 5 }, () => new Sensor());
const layout = new LayoutManager();

let imgs = [];
let woodBg = null;

// --- NEW: Offscreen & dual-screen management ---
let pg;                 // offscreen p5.Graphics (virtual canvas)
let VIRTUAL_W = 0;      // virtual width = LEFT + BEZEL + RIGHT
let LEFT_W = 0;         // left monitor width
let RIGHT_W = 0;        // right monitor width
let showCalib = false;  // toggle calibration overlay

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
  const d = CONFIG.display;
  
  if (d.useFullscreen) {
    createCanvas(windowWidth, windowHeight);
  } else {
    createCanvas(d.fixedWidth, d.fixedHeight);
  }

  // Disable page scrolling (keeps the sketch non-scrollable)
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.margin = '0';
  document.body.style.padding = '0';

  // Compute monitor widths
  if (d.dualScreens) {
    LEFT_W  = d.leftWidthPx  || floor(width / 2);
    RIGHT_W = d.rightWidthPx || (width - LEFT_W);
  } else {
    LEFT_W = width; RIGHT_W = 0;
  }

  // Virtual canvas includes invisible bezel gutter
  VIRTUAL_W = LEFT_W + d.bezelCompPx + RIGHT_W;
  pg = createGraphics(VIRTUAL_W, height);

  textFont('monospace');
  textSize(18);

  // IMPORTANT: layout based on virtual width so visuals span across both screens + bezel gutter
  layout.compute(VIRTUAL_W, height);
  
  console.log('🌸 Flower Visualizer initialized');
}

function windowResized() {
  if (!CONFIG.display.useFullscreen) return;
  const d = CONFIG.display;

  resizeCanvas(windowWidth, windowHeight);

  if (d.dualScreens) {
    LEFT_W  = d.leftWidthPx  || floor(width / 2);
    RIGHT_W = d.rightWidthPx || (width - LEFT_W);
  } else {
    LEFT_W = width; RIGHT_W = 0;
  }

  VIRTUAL_W = LEFT_W + d.bezelCompPx + RIGHT_W;
  pg = createGraphics(VIRTUAL_W, height);
  layout.compute(VIRTUAL_W, height);
}

// ========== Main Draw Loop ==========
function draw() {
  // 1) Draw the entire scene into the offscreen virtual canvas
  pg.push();
  drawBackgroundTo(pg);
  updateSensorData();
  updateAlphas();
  drawFlowersTo(pg);
  if (showCalib) drawCalibrationOverlayTo(pg);
  pg.pop();

  // 2) Blit to the real canvas in two chunks, skipping the bezel gutter
  clear(); // ensure clean compositing
  const d = CONFIG.display;

  const leftSrcX  = 0;
  const leftSrcW  = LEFT_W;
  const rightSrcX = LEFT_W + d.bezelCompPx; // skip the hidden gutter
  const rightSrcW = RIGHT_W;

  // Left monitor region
  image(pg,
    /*dx*/ 0, /*dy*/ 0, /*dw*/ LEFT_W, /*dh*/ height,
    /*sx*/ leftSrcX, /*sy*/ 0, /*sw*/ leftSrcW, /*sh*/ height
  );

  // Right monitor region
  image(pg,
    /*dx*/ LEFT_W, /*dy*/ 0, /*dw*/ RIGHT_W, /*dh*/ height,
    /*sx*/ rightSrcX, /*sy*/ 0, /*sw*/ rightSrcW, /*sh*/ height
  );
}

// ========== Background Rendering (to target renderer) ==========
function drawBackgroundTo(g) {
  if (!woodBg) {
    g.background(40);
    return;
  }

  const canvasAR = g.width / g.height;
  const imgAR = woodBg.width / woodBg.height;
  let dw, dh, dx, dy;

  if (imgAR > canvasAR) {
    // Image is wider - fit to height
    dh = g.height;
    dw = imgAR * dh;
    dx = (g.width - dw) / 2;
    dy = 0;
  } else {
    // Image is taller - fit to width
    dw = g.width;
    dh = dw / imgAR;
    dx = 0;
    dy = (g.height - dh) / 2;
  }

  g.image(woodBg, dx, dy, dw, dh);
}

// ========== Sensor & Alpha Updates ==========
function updateSensorData() {
  const now = millis();
  
  if (now >= state.nextUpdateAt) {
    const line = generateMockArduinoLine();
    state.analogVals = line.slice(0, 5);
    state.digitalVals = line.slice(5, 10);
    
    console.log(`[${line.join(",")}]`);
    
    for (let i = 0; i < 5; i++) {
      applyDebounceRebounce(i, state.digitalVals[i] === 1);
    }
    
    state.nextUpdateAt = now + 1000 / CONFIG.timing.updateHz;
  }
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

// ========== Flower Rendering (to target renderer) ==========
function drawFlowersTo(g) {
  for (let i = 0; i < 5; i++) {
    drawFlowerInSlotTo(g, i);
  }
}

function drawFlowerInSlotTo(g, i) {
  if (!imgs[i]) return;

  const img = imgs[i];
  const ar = img.width / img.height;
  const cx = layout.getSlotCenter(i);
  
  // Calculate dimensions with aspect ratio preservation
  const maxW = layout.slotWidth * CONFIG.layout.slotFill;
  let drawH = layout.targetH;
  let drawW = drawH * ar;

  // Width constraint check
  if (drawW > maxW) {
    drawW = maxW;
    drawH = drawW / ar;
  }

  // Bottom-align on baseline
  const cy = layout.yBaseline - drawH / 2;

  g.push();
  g.imageMode(CENTER);
  g.tint(255, constrain(state.alphas[i], 0, 255));
  g.image(img, cx, cy, drawW, drawH);
  g.pop();
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

// ========== Calibration Overlay (NEW) ==========
function keyPressed() {
  const d = CONFIG.display;
  if (key === 'c' || key === 'C') showCalib = !showCalib;
  if (key === '+' || key === '=') {
    d.bezelCompPx++;
    recomputeVirtual();
  }
  if (key === '-' || key === '_') {
    d.bezelCompPx = max(0, d.bezelCompPx - 1);
    recomputeVirtual();
  }
}

function recomputeVirtual() {
  const d = CONFIG.display;
  VIRTUAL_W = LEFT_W + d.bezelCompPx + RIGHT_W;
  pg = createGraphics(VIRTUAL_W, height);
  layout.compute(VIRTUAL_W, height);
}

function drawCalibrationOverlayTo(g) {
  g.push();
  g.stroke(255);
  g.strokeWeight(2);
  // seam lines around the bezel region in virtual space
  const d = CONFIG.display;
  const seamL = LEFT_W;                 // left edge of bezel
  const seamR = LEFT_W + d.bezelCompPx; // right edge of bezel
  g.line(seamL, 0, seamL, g.height);
  g.line(seamR, 0, seamR, g.height);

  // center ticks
  for (let y = 0; y < g.height; y += 40) {
    g.line(seamL - 20, y, seamL, y);
    g.line(seamR, y, seamR + 20, y);
  }

  // hint text
  g.noStroke();
  g.fill(255);
  g.textSize(16);
  g.textAlign(CENTER, TOP);
  g.text(
    `Bezel compensation: ${d.bezelCompPx}px  (+/- to adjust, C to toggle)`,
    (seamL + seamR) / 2,
    8
  );
  g.pop();
}

/* ====== (Optional) Original single-canvas draw helpers retained for completeness ======
   These are not used in the new dual-screen pipeline, but preserved to avoid removing
   any prior functionality or references. You can revert to the original flow by
   calling these from draw() if desired. */

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

function drawFlowers() {
  for (let i = 0; i < 5; i++) {
    drawFlowerInSlot(i);
  }
}

function drawFlowerInSlot(i) {
  if (!imgs[i]) return;

  const img = imgs[i];
  const ar = img.width / img.height;
  const cx = layout.getSlotCenter(i);
  
  const maxW = layout.slotWidth * CONFIG.layout.slotFill;
  let drawH = layout.targetH;
  let drawW = drawH * ar;

  if (drawW > maxW) {
    drawW = maxW;
    drawH = drawW / ar;
  }

  const cy = layout.yBaseline - drawH / 2;

  push();
  imageMode(CENTER);
  tint(255, constrain(state.alphas[i], 0, 255));
  image(img, cx, cy, drawW, drawH);
  pop();
}
