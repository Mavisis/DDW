let serial;
let latestData = "waiting for data";

// Raw data from serial and derived display values (with cascade)
let rawValues = [1, 1, 1, 1, 1];
let displayValues = [1, 1, 1, 1, 1];

// Fade bookkeeping
const lastActive = [0, 0, 0, 0, 0]; // ms timestamp when sensor last went 0
const fadeDuration = 3000;         // 10 seconds

// Images
let flowers = []; // array of 5 p5.Image

function preload() {
  // Load your images here (same image or unique per slot)
  // Replace with your own file names/paths if needed
  flowers[0] = loadImage("./flower-images/Fase1.png");
  flowers[1] = loadImage("./flower-images/Fase2.png");
  flowers[2] = loadImage("./flower-images/Fase3.png");
  flowers[3] = loadImage("./flower-images/Fase4.png");
  flowers[4] = loadImage("./flower-images/Fase5.png");
}

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

  imageMode(CORNER);
  noStroke();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function serverConnected() { print("Connected to Server"); }

function gotList(thelist) {
  print("List of Serial Ports:");
  for (let i = 0; i < thelist.length; i++) {
    print(i + " " + thelist[i]);
  }
}

function gotOpen() { print("Serial Port is Open"); }

function gotClose() {
  print("Serial Port is Closed");
  latestData = "Serial Port is Closed";
}

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

// Left→right cascade: if the first zero is at index k, force 0..k to 0.
function applyCascade() {
  displayValues = rawValues.slice();
  const firstZeroIdx = rawValues.findIndex(v => v === 0);
  if (firstZeroIdx !== -1) {
    for (let i = 0; i <= firstZeroIdx; i++) displayValues[i] = 0;
  }
}

function draw() {
  background(240);

  const n = displayValues.length;
  const margin = 20;
  const gap = 14;
  const totalGap = gap * (n - 1);
  const slotW = (width - margin * 2 - totalGap) / n;
  const slotH = min(height * 0.65, slotW * 1.2);
  const y = (height - slotH) / 2;

  const now = millis();

  for (let i = 0; i < n; i++) {
    // When a sensor is "active" (0), refresh its last active time
    if (displayValues[i] === 0) {
      lastActive[i] = now;
    }

    // How long since last activation
    const elapsed = now - lastActive[i];

    // Opacity (alpha): 255 when just activated; then fades to 0 over 10s
    let alpha = 0;
    if (elapsed <= 0) {
      alpha = 0; // never activated yet -> invisible
    } else if (elapsed < fadeDuration) {
      // Fade from 255 → 0 as time increases (linear)
      alpha = map(elapsed, 0, fadeDuration, 255, 0);
    } else {
      alpha = 0; // fully faded
    }

    // Draw the image centered in its slot, preserving aspect ratio
    const x = margin + i * (slotW + gap);
    const img = flowers[i % flowers.length];

    if (img && img.width > 0 && img.height > 0) {
      // Fit image into slotW x slotH while keeping aspect
      const imgAspect = img.width / img.height;
      const slotAspect = slotW / slotH;

      let drawW, drawH;
      if (imgAspect > slotAspect) {
        // image is wider → full width, scale height
        drawW = slotW;
        drawH = slotW / imgAspect;
      } else {
        // image is taller → full height, scale width
        drawH = slotH;
        drawW = slotH * imgAspect;
      }
      const offsetX = x + (slotW - drawW) / 2;
      const offsetY = y + (slotH - drawH) / 2;

      // Apply alpha via tint
      tint(255, alpha);
      image(img, offsetX, offsetY, drawW, drawH);
      noTint(); // reset tint so it doesn't affect later draws
    } else {
      // Fallback: draw a placeholder rect if image not loaded
      fill(200, 200, 200, alpha);
      rect(x, y, slotW, slotH, 8);
    }
  }

  // Debug labels
  noStroke();
  fill(0);
  textSize(14);
  textAlign(LEFT, TOP);
  text("Raw:     " + rawValues.join(","), margin, 10);
  text("Display: " + displayValues.join(","), margin, 28);
  text("Latest:  " + latestData, margin, 46);
}
