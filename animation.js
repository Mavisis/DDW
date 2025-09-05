let totalSlots = 5;   // total number of fixed positions
let numSquares = 5;   // how many to show (changes with key)
let squareSize = 50;

let log = [];         // stores pressed keys
let maxLog = 10;      // max number of keys to display

function setup() {
  createCanvas(900, 200); // wider canvas to fit squares + log
  textSize(20);
}

function draw() {
  background(220);

  // ----- Squares Section -----
  let spacing = 600 / (totalSlots + 1); // left 600px reserved for squares
  for (let i = 0; i < totalSlots; i++) {
    let x = (i + 1) * spacing;
    let y = height / 2;

    if (i < numSquares) {
      fill(0); // black for active squares
    } else {
      fill(200); // gray for empty slots
    }

    noStroke();
    rectMode(CENTER);
    rect(x, y, squareSize, squareSize);
  }

  // ----- Logger Section -----
  fill(50);
  textAlign(LEFT, TOP);
  text("Key Log:", 620, 20);

  for (let i = 0; i < log.length; i++) {
    text(log[i], 620, 50 + i * 25);
  }
}

function keyPressed() {
  // update square count if number between 0 and 5
  if (key >= '0' && key <= '5') {
    numSquares = int(key);
  }

  // push key to log
  log.push(key);
  if (log.length > maxLog) {
    log.shift(); // remove oldest if too long
  }
}
