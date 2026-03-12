/**
 * Test Telemetry Flow
 * Simulates multiple drones sending telemetry via WebSocket
 *
 * Usage: node ./scripts/test-telemetry.js
 */

require("dotenv").config();
const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";

// Simulate drone telemetry data
class DroneSimulator {
    constructor(droneId, options = {}) {
        this.droneId = droneId;
        this.startLat = options.startLat || 10.8231 + Math.random() * 0.1;
        this.startLng = options.startLng || 106.6297 + Math.random() * 0.1;
        this.currentLat = this.startLat;
        this.currentLng = this.startLng;
        this.altitude = options.altitude || 100;
        this.speed = options.speed || 10;
        this.heading = options.heading || 0;
        this.batteryLevel = options.batteryLevel || 100;
        this.frequency = options.frequency || 5000; // ms between messages
        this.messageCount = 0;
    }

    generateTelemetry() {
        // Simulate movement
        const latChange = (Math.random() - 0.5) * 0.0001;
        const lngChange = (Math.random() - 0.5) * 0.0001;
        const altChange = (Math.random() - 0.5) * 0.5;
        const headingChange = (Math.random() - 0.5) * 5;

        this.currentLat += latChange;
        this.currentLng += lngChange;
        this.altitude = Math.max(0, this.altitude + altChange);
        this.heading = (this.heading + headingChange) % 360;
        this.batteryLevel = Math.max(0, this.batteryLevel - 0.1);

        return {
            droneId: this.droneId,
            lat: parseFloat(this.currentLat.toFixed(6)),
            lng: parseFloat(this.currentLng.toFixed(6)),
            alt: parseFloat(this.altitude.toFixed(2)),
            speed: parseFloat(this.speed.toFixed(2)),
            heading: parseFloat(this.heading.toFixed(2)),
            batteryLevel: parseFloat(this.batteryLevel.toFixed(1)),
            timestamp: Date.now(),
        };
    }

    async sendTelemetry(socket) {
        const telemetry = this.generateTelemetry();
        socket.emit("telemetry", telemetry);
        this.messageCount++;
        return telemetry;
    }
}

// Test Flow
async function runTest() {
    console.log("🚀 Starting Telemetry Test\n");
    console.log(`📌 Configuration:`);
    console.log(`   Base URL: ${BASE_URL}`);
    console.log(`   WebSocket URL: ${WS_URL}`);
    console.log("");

    // Get JWT token (you may need to adjust based on your auth implementation)
    let token;
    try {
        console.log("🔐 Obtaining JWT token...");
        // This depends on your authentication implementation
        // For now, we'll use a simple token or skip if not available
        token = process.env.TEST_JWT_TOKEN || "test-token";
        console.log("✅ Token obtained\n");
    } catch (err) {
        console.error("⚠️ Could not obtain token:", err.message);
        return;
    }

    // Connect to WebSocket
    const io = require("socket.io-client");

    const socket = io(WS_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        auth: {
            token,
        },
    });

    socket.on("connect", () => {
        console.log("✅ Connected to WebSocket\n");
    });

    socket.on("connected", (msg) => {
        console.log("📡 Server message:", msg.message);
        console.log(`   User ID: ${msg.userId}`);
        console.log(`   Role: ${msg.role}\n`);
    });

    socket.on("telemetry_ack", (msg) => {
        console.log(`✅ ACK received for drone ${msg.droneId}: ${msg.status}`);
    });

    socket.on("error", (err) => {
        console.error("❌ Socket error:", err);
    });

    socket.on("disconnect", () => {
        console.log("🔌 Disconnected from server");
    });

    // Wait for connection
    await new Promise((resolve) => {
        socket.on("connect", resolve);
    });

    // Create drone simulators
    const drones = [
        new DroneSimulator("drone-001", { frequency: 1000 }),
        new DroneSimulator("drone-002", { frequency: 1000 }),
        new DroneSimulator("drone-003", { frequency: 1000 }),
    ];

    console.log(`🚁 Created ${drones.length} drone simulators\n`);

    // Send telemetry
    console.log("📤 Starting telemetry stream...\n");

    let totalMessages = 0;
    const startTime = Date.now();
    const testDuration = 30000; // 30 seconds

    // Send telemetry in intervals
    const telemetryInterval = setInterval(() => {
        if (Date.now() - startTime > testDuration) {
            clearInterval(telemetryInterval);
            console.log("\n⏹️  Test duration reached, stopping...\n");

            // Summary
            const duration = Date.now() - startTime;
            const messagesPerSecond = (totalMessages / duration) * 1000;

            console.log("📊 Test Summary:");
            console.log(`   Total messages sent: ${totalMessages}`);
            console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
            console.log(`   Messages per second: ${messagesPerSecond.toFixed(2)}`);
            console.log(`   Drones: ${drones.map((d) => d.messageCount).join(", ")}`);

            socket.disconnect();
            process.exit(0);
            return;
        }

        drones.forEach((drone) => {
            drone.sendTelemetry(socket).then((telemetry) => {
                totalMessages++;
                if (totalMessages % 10 === 0) {
                    console.log(
                        `📨 Sent ${totalMessages} messages | Average: ${(totalMessages / ((Date.now() - startTime) / 1000)).toFixed(0)} msg/s`
                    );
                }
            });
        });
    }, 1000); // Send every second total
}

// Run test
runTest().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
