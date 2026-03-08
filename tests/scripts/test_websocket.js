/**
 * Manual Socket.IO Test Script
 *
 * Usage:
 *   1. Start server: npm run dev
 *   2. Login and get a JWT token
 *   3. Run: node tests/scripts/test_websocket.js <JWT_TOKEN> <SESSION_ID>
 *
 * This script:
 *   - Connects to Socket.IO server
 *   - Authenticates with JWT
 *   - Watches a session for alerts
 *   - Sends simulated telemetry every 10 seconds
 *   - Prints all received messages
 */

const { io } = require("socket.io-client");

const JWT_TOKEN = process.argv[2];
const SESSION_ID = process.argv[3];
const WS_URL = process.env.WS_URL || "http://localhost:3000";

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

console.log(
  `Connecting to ${WS_URL} with path /ws and token ${JWT_TOKEN.substring(0, 20)}...`,
);

const socket = io(WS_URL, {
  path: "/ws",
  auth: {
    token: JWT_TOKEN,
  },
});

socket.on("connect", () => {
  console.log("✅ Socket.IO connected!\n");

  // Watch the session for alerts
  console.log(`📡 Watching session: ${SESSION_ID}`);
  socket.emit("watch_session", { sessionId: SESSION_ID });

  // Simulate telemetry every 10 seconds
  let counter = 0;
  const baseLat = 10.8231;
  const baseLng = 106.6297;

  const interval = setInterval(() => {
    counter++;
    const telemetryData = {
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
    socket.emit("telemetry", telemetryData);

    // Stop after 30 iterations (5 minutes)
    if (counter >= 30) {
      console.log("\n⏹️  Test complete (30 iterations)");
      clearInterval(interval);
      socket.disconnect();
    }
  }, 10000);
});

socket.on("connected", (data) => {
  console.log(
    `\n📩 [${new Date().toISOString()}] Connected Event:`,
    JSON.stringify(data),
  );
});

socket.on("watching", (data) => {
  console.log(
    `\n📩 [${new Date().toISOString()}] Watching Event:`,
    JSON.stringify(data),
  );
});

socket.on("alert", (msg) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🚨 [${timestamp}] ALERT RECEIVED:`);
  console.log(`   Type: ${msg.type}`);
  console.log(`   Severity: ${msg.severity}`);
  console.log(`   Message: ${msg.message}`);
  if (msg.data) {
    console.log(`   Data:`, JSON.stringify(msg.data, null, 4));
  }
});

socket.on("telemetry_ack", (msg) => {
  console.log(`   ✅ Telemetry ACK: ${msg.telemetryId}`);
});

socket.on("error", (err) => {
  console.log(`\n❌ [${new Date().toISOString()}] ERROR RECEIVED:`, err);
});

socket.on("disconnect", (reason) => {
  console.log(`\n🔌 Connection closed (reason: ${reason})`);
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("❌ Socket.IO connection error:", err.message);
  process.exit(1);
});
