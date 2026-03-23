require("dotenv").config();
const mongoose = require("mongoose");
const redis = require("redis");

const Drone = require("../models/drone.model");
const Telemetry = require("../src/modules/telemetry/telemetry.model");

const STREAM_KEY = "telemetry:stream";

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("Missing MONGO_URI/MONGODB_URI in .env");
    }

    await mongoose.connect(mongoUri);

    const redisClient = redis.createClient({
        socket: {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379", 10),
        },
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || "0", 10),
    });

    await redisClient.connect();

    const drone = await Drone.findOne({}).select("_id droneId").lean();
    if (!drone) {
        throw new Error("No drone found in DB. Please create at least 1 drone first.");
    }

    const marker = Date.now();
    const msgId = await redisClient.xAdd(STREAM_KEY, "*", {
        droneId: drone.droneId,
        sessionId: "",
        lat: "10.8231",
        lng: "106.6297",
        alt: "120",
        speed: "12",
        heading: "90",
        batteryLevel: "85",
        timestamp: String(marker),
        receivedAt: new Date().toISOString(),
        sourceGateway: "verify-script",
        sourceUser: "verify-script",
    });

    console.log(`[verify] xAdd done. streamId=${msgId}, droneId=${drone.droneId}`);

    await sleep(9000);

    const inserted = await Telemetry.findOne({
        drone: drone._id,
        timestamp: { $gte: new Date(marker - 1000) },
    })
        .sort({ timestamp: -1 })
        .lean();

    if (!inserted) {
        console.log("[verify] FAIL: No telemetry found in DB for injected message window.");
        process.exitCode = 2;
    } else {
        console.log("[verify] PASS: Telemetry found in DB.");
        console.log(
            JSON.stringify(
                {
                    _id: inserted._id,
                    drone: inserted.drone,
                    timestamp: inserted.timestamp,
                    location: inserted.location,
                    altitude: inserted.altitude,
                    speed: inserted.speed,
                    heading: inserted.heading,
                    batteryLevel: inserted.batteryLevel,
                    isSampled: inserted.isSampled,
                },
                null,
                2,
            ),
        );
    }

    await redisClient.quit();
    await mongoose.connection.close();
}

main().catch(async (err) => {
    console.error("[verify] ERROR:", err.message);
    try {
        await mongoose.connection.close();
    } catch (_) { }
    process.exitCode = 1;
});
