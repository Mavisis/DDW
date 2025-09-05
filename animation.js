function setup() {
  // Runs once at the start
  createCanvas(600, 400); // width, height
  background(220);        // light gray background
}

function draw() {
  // Runs continuously after setup
  background(220);        // clear frame each draw cycle

  // Example: a moving circle that follows your mouse
  fill(100, 150, 255);
  noStroke();
  ellipse(mouseX, mouseY, 50, 50);
}
