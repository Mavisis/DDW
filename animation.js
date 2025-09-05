let totalSlots = 5;   // total number of fixed positions
let numSquares = 5;   // how many to show (changes with key)
let squareSize = 50;

function setup() {
  createCanvas(600, 200);
}

function draw() {
  background(220);

  // spacing based on the total fixed slots
  let spacing = width / (totalSlots + 1);

  for (let i = 0; i < totalSlots; i++) {
    let x = (i + 1) * spacing;
    let y = height / 2;

    if (i < numSquares) {
      fill(0); // black for active squares
    } else {
      fill(200); // gray (or background color) for empty slots
    }

    noStroke();
    rectMode(CENTER);
    rect(x, y, squareSize, squareSize);
  }
}

function keyPressed() {
  if (key >= '0' && key <= '5') {   // only 0–5 are valid
    numSquares = int(key);
  }
}
