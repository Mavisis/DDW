// sketch.js — mock Arduino serial + digital-driven images with debounce/rebounce

// === Tweakable settings ===
let updateHz = 2;               // serial line generation frequency (== print frequency)
let activationDelayMs = 120;     // debounce: require 1 to persist this long before showing image
let deactivationDelayMs = 150;   // rebounce: require 0 to persist this long before hiding image

let baseImgSize = 120;           // base square image size
let imgScale = 1.0;              // global scale multiplier for images (e.g., 0.8, 1.2, etc.)
let bottomMargin = 30;           // distance from bottom of canvas to image bottoms
let slotGap = 30;                // gap between images

let analogVals = [0, 0, 0, 0, 0];
let digitalVals = [0, 0, 0, 0, 0];
let visibleState = [false, false, false, false, false]; // after debounce/rebounce filtering
let imgs = [];

let nextUpdateAt = 0;
let imgPositions = [];

// Per-sensor timing state for debounce/rebounce
const sensors = Array.from({ length: 5 }, () => ({
  pending: null,          // 'on' or 'off' or null
  pendingStart: 0,        // millis() timestamp when pending started
}));

function preload() {
  // Load Fase0.png ... Fase4.png from folder "flower-images"
  for (let i = 0; i < 5; i++) {
    const path = `flower-images/Fase${i}.png`;
    imgs[i] = loadImage(
      path,
      () => {},                          // ok
      () => { console.warn(`Failed to load ${path}`); imgs[i] = null; }
    );
  }
}

function setup() {
  createCanvas(900, 520);
  textFont('monospace');
  textSize(16);

  computeLayout();
}

function windowResized() {
  // If you make the canvas responsive, recompute positions:
  // resizeCanvas(windowWidth, windowHeight);
  computeLayout();
}

function computeLayout() {
  imgPositions = [];
  const size = baseImgSize * imgScale;
  const totalWidth = 5 * size + 4 * slotGap;
  const startX = (width - totalWidth) / 2;
  const yBottom = height - bottomMargin;
  const yTop = yBottom - size;

  for (let i = 0; i < 5; i++) {
    imgPositions.push({
      x: startX + i * (size + slotGap),
      y: yTop,
      size: size,
    });
  }
}

function draw() {
  background(20);

  // Generate a new "serial line" at the chosen frequency
  if (millis() >= nextUpdateAt) {
    const line = generateMockArduinoLine();

    analogVals = line.slice(0, 5);
    digitalVals = line.slice(5, 10);

    // Print full 10-value line (like Arduino would)
    console.log(`[${line.join(",")}]`);

    // Update debounce/rebounce per sensor from latest digital bits
    for (let i = 0; i < 5; i++) {
      applyDebounceRebounce(i, digitalVals[i] === 1);
    }

    nextUpdateAt = millis() + 1000 / updateHz;
  }

  // HUD text
  fill(235);
  text(`Analog: [${analogVals.join(", ")}]`, 20, 20);
  text(`Digital: [${digitalVals.join(", ")}]`, 20, 46);
  text(`Rule: bit 1 ⇒ show; bit 0 ⇒ hide (with debounce/rebounce)`, 20, 72);
  text(`updateHz=${updateHz}  act=${activationDelayMs}ms  deact=${deactivationDelayMs}ms`, 20, 98);
  text(`imgScale=${imgScale.toFixed(2)}  size=${(baseImgSize*imgScale)|0}px`, 20, 124);

  // Draw image slots near bottom, showing images only when visibleState[i] is true
  for (let i = 0; i < 5; i++) {
    const { x, y, size } = imgPositions[i];

    // Frame
    noFill();
    stroke(80);
    rect(x - 6, y - 6, size + 12, size + 12, 10);

    // Label
    noStroke();
    fill(180);
    textAlign(CENTER, BOTTOM);
    text(`Sensor ${i + 1}: ${visibleState[i] ? "1" : "0"}`, x + size / 2, y - 10);

    if (visibleState[i]) {
      if (imgs[i]) {
        image(imgs[i], x, y, size, size);
      } else {
        // Placeholder if image missing
        push();
        fill(60);
        rect(x, y, size, size, 8);
        fill(200);
        textAlign(CENTER, CENTER);
        text("image", x + size / 2, y + size / 2);
        pop();
      }
    } else {
      // Hidden: faint placeholder
      push();
      noFill();
      stroke(50);
      rect(x, y, size, size, 8);
      pop();
    }
  }
}

/**
 * Debounce (activation) + Rebounce (deactivation) logic per sensor.
 * - If incoming bit = 1, require it to persist activationDelayMs before turning visible ON.
 * - If incoming bit = 0, require it to persist deactivationDelayMs before turning visible OFF.
 * This avoids flicker in both directions.
 */
function applyDebounceRebounce(index, bitIsOne) {
  const now = millis();
  const currentlyVisible = visibleState[index];

  if (bitIsOne) {
    // Request to go ON
    if (currentlyVisible) {
      // Already ON — clear any pending OFF
      sensors[index].pending = null;
    } else {
      // Not visible yet — set or check pending ON
      if (sensors[index].pending !== 'on') {
        sensors[index].pending = 'on';
        sensors[index].pendingStart = now;
      } else if (now - sensors[index].pendingStart >= activationDelayMs) {
        visibleState[index] = true;
        sensors[index].pending = null;
      }
    }
  } else {
    // Request to go OFF
    if (!currentlyVisible) {
      // Already OFF — clear any pending ON
      sensors[index].pending = null;
    } else {
      // Visible — set or check pending OFF
      if (sensors[index].pending !== 'off') {
        sensors[index].pending = 'off';
        sensors[index].pendingStart = now;
      } else if (now - sensors[index].pendingStart >= deactivationDelayMs) {
        visibleState[index] = false;
        sensors[index].pending = null;
      }
    }
  }
}

/** Generate a 10-value mock line: 5 analog [0..1023], 5 digital [0/1] */
function generateMockArduinoLine() {
  const a = [];
  const d = [];

  // Analog values (random full range; tweak if needed)
  for (let i = 0; i < 5; i++) a.push(Math.floor(random(0, 1024)));

  // Digital values — adjust probability to taste
  const coveredProb = 0.45; // chance of a 1 (covered) per tick
  for (let i = 0; i < 5; i++) d.push(Math.random() < coveredProb ? 1 : 0);

  return a.concat(d);
}
