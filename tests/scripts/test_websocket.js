/**
 * Manual WebSocket Test Script
 *
 * Usage:
 *   1. Start server: npm run dev
 *   2. Login and get a JWT token
 *   3. Run: node tests/scripts/test_websocket.js <JWT_TOKEN> <SESSION_ID>
 *
 * This script:
 *   - Connects to WebSocket server
 *   - Authenticates with JWT
 *   - Watches a session for alerts
 *   - Sends simulated telemetry every 10 seconds
 *   - Prints all received messages
 */

const WebSocket = require("ws");

const JWT_TOKEN = process.argv[2];
const SESSION_ID = process.argv[3];
const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

if (!JWT_TOKEN || !SESSION_ID) {
  console.log("Usage: node test_websocket.js <JWT_TOKEN> <SESSION_ID>");
  console.log("\nFlow trước khi chạy script này:");
  console.log("  1. Login → lấy JWT token");
  console.log("  2. Tạo drone (POST /api/drones)");
  console.log(
    "  3a. Tạo FlightPlan → Submit → APPROVED → Start Planned Session",
  );
  console.log("  3b. Hoặc Start Free Flight Session (INDIVIDUAL_OPERATOR)");
  console.log("  4. Lấy session ID từ response");
  console.log("  5. Chạy script này với JWT token và session ID");
  process.exit(1);
}

console.log(`Connecting to ${WS_URL}?token=${JWT_TOKEN.substring(0, 20)}...`);

const ws = new WebSocket(`${WS_URL}?token=${JWT_TOKEN}`);

ws.on("open", () => {
  console.log("✅ WebSocket connected!\n");

  // Watch the session for alerts
  console.log(`📡 Watching session: ${SESSION_ID}`);
  ws.send(JSON.stringify({ type: "watch_session", sessionId: SESSION_ID }));

  // Simulate telemetry every 10 seconds
  let counter = 0;
  const baseLat = 10.8231;
  const baseLng = 106.6297;

  const interval = setInterval(() => {
    counter++;
    const telemetryData = {
      type: "telemetry",
      sessionId: SESSION_ID,
      data: {
        lat: baseLat + counter * 0.001, // Move north
        lng: baseLng + counter * 0.001, // Move east
        altitude: 100 + Math.sin(counter) * 20, // Oscillate altitude
        speed: 15 + Math.random() * 5,
        heading: (counter * 30) % 360,
        batteryLevel: Math.max(5, 100 - counter * 3), // Decrease battery
      },
    };

    console.log(
      `\n📤 [${new Date().toISOString()}] Sending telemetry #${counter}:`,
      JSON.stringify(telemetryData.data, null, 2),
    );
    ws.send(JSON.stringify(telemetryData));

    // Stop after 30 iterations (5 minutes)
    if (counter >= 30) {
      console.log("\n⏹️  Test complete (30 iterations)");
      clearInterval(interval);
      ws.close();
    }
  }, 10000);
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());
    const timestamp = new Date().toISOString();

    if (msg.type === "alert") {
      console.log(`\n🚨 [${timestamp}] ALERT RECEIVED:`);
      console.log(`   Type: ${msg.alert.type}`);
      console.log(`   Severity: ${msg.alert.severity}`);
      console.log(`   Message: ${msg.alert.message}`);
      if (msg.alert.data) {
        console.log(`   Data:`, JSON.stringify(msg.alert.data, null, 4));
      }
    } else if (msg.type === "telemetry_ack") {
      console.log(`   ✅ Telemetry ACK: ${msg.telemetryId}`);
    } else {
      console.log(`\n📩 [${timestamp}] ${msg.type}:`, JSON.stringify(msg));
    }
  } catch (err) {
    console.log("Raw message:", data.toString());
  }
});

ws.on("close", (code, reason) => {
  console.log(`\n🔌 Connection closed (code: ${code}, reason: ${reason})`);
  process.exit(0);
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error:", err.message);
  process.exit(1);
});
