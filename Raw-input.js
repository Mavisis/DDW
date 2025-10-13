let serial;
let latestData = "waiting for data";
let sensorValues = [0, 0, 0, 0, 0]; // default state

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

function serverConnected() {
  print("Connected to Server");
}

function gotList(thelist) {
  print("List of Serial Ports:");
  for (let i = 0; i < thelist.length; i++) {
    print(i + " " + thelist[i]);
  }
}

function gotOpen() {
  print("Serial Port is Open");
}

function gotClose() {
  print("Serial Port is Closed");
  latestData = "Serial Port is Closed";
}

function gotError(theerror) {
  print(theerror);
}

function gotData() {
  let currentString = serial.readLine();
  if (!currentString) return;

  currentString = trim(currentString);
  if (currentString.length === 0) return;

  // Expecting something like: [0,1,0,1,1]
  try {
    // Remove brackets if present
    currentString = currentString.replace(/[\[\]]/g, "");
    let parts = currentString.split(",").map(v => int(v));
    if (parts.length === 5) {
      sensorValues = parts;
    }
    latestData = currentString;
    console.log("Parsed sensors:", sensorValues);
  } catch (err) {
    console.error("Parse error:", err, "on string:", currentString);
  }
}

function draw() {
  background(220);

  let boxWidth = width / sensorValues.length;
  let boxHeight = height / 2;

  for (let i = 0; i < sensorValues.length; i++) {
    if (sensorValues[i] === 0) {
      fill(0); // black
    } else {
      fill(255); // white
    }
    stroke(100);
    rect(i * boxWidth, height / 4, boxWidth, boxHeight);
  }

  // Optional: show raw incoming string at top-left
  fill(0);
  noStroke();
  textSize(16);
  text("Latest: " + latestData, 10, 20);
}
