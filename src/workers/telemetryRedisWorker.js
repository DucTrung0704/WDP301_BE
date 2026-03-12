/**
 * Telemetry Worker Process (Redis Streams)
 * Consumes telemetry messages from Redis Streams and batch inserts into MongoDB
 *
 * Usage: node ./src/workers/telemetryRedisWorker.js
 * Or: npm run worker
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { redisClientAsync, streamOps, REDIS_KEYS } = require("../config/redis");
const Telemetry = require("../modules/telemetry/telemetry.model");

// ========== SAMPLING CONFIGURATION ==========
const SAMPLING_CONFIG = {
    enabled: process.env.TELEMETRY_SAMPLING_ENABLED !== "false",
    ratio: parseInt(process.env.TELEMETRY_SAMPLING_RATIO) || 10,
    minInterval: parseInt(process.env.TELEMETRY_MIN_INTERVAL) || 1000,
};

// ========== TELEMETRY BATCHER CLASS ==========
class TelemetryBatcher {
    constructor(batchSize = 1000, flushIntervalMs = 5000) {
        this.buffer = [];
        this.batchSize = batchSize;
        this.flushIntervalMs = flushIntervalMs;
        this.flushTimer = null;
        this.lastSavedTime = new Map();  // Track per-drone sampling
        this.stats = {
            received: 0,
            inserted: 0,
            sampled: 0,  // Track sampled out records
            failed: 0,
            totalTime: 0,
        };

        // Auto-flush according to time
        this.startAutoFlush();
    }

    /**
     * Check if telemetry point should be saved to database
     * Implements intelligent sampling before inserting to DB
     */
    shouldSaveToDatabase(droneId, timestamp) {
        if (!SAMPLING_CONFIG.enabled) return true;

        const lastTime = this.lastSavedTime.get(droneId) || 0;
        const timeDelta = timestamp - lastTime;

        // Condition 1: Minimum interval must pass
        if (timeDelta < SAMPLING_CONFIG.minInterval) {
            return false;
        }

        // Condition 2: Random chance (1/ratio)
        if (Math.random() * SAMPLING_CONFIG.ratio < 1) {
            this.lastSavedTime.set(droneId, timestamp);
            return true;
        }

        return false;
    }

    add(telemetryDoc) {
        this.stats.received++;

        // Check if should sample this out
        const timestamp = telemetryDoc.timestamp.getTime();
        if (!this.shouldSaveToDatabase(telemetryDoc.drone, timestamp)) {
            this.stats.sampled++;
            return;  // Don't add to buffer, skip this record
        }

        // Add to buffer if passed sampling
        this.buffer.push({
            ...telemetryDoc,
            isSampled: true,  // Mark as sampled-down
        });

        // Flush when reaching batch size
        if (this.buffer.length >= this.batchSize) {
            this.flush();
        }
    }

    startAutoFlush() {
        this.flushTimer = setInterval(() => {
            if (this.buffer.length > 0) {
                console.log(
                    `⏰ Auto-flush: ${this.buffer.length} records buffered for ${this.flushIntervalMs}ms`
                );
                this.flush();
            }
        }, this.flushIntervalMs);
    }

    async flush() {
        if (this.buffer.length === 0) return;

        const batch = this.buffer.splice(0, this.buffer.length);
        const batchSize = batch.length;
        const startTime = Date.now();

        try {
            const result = await Telemetry.insertMany(batch, {
                ordered: false, // Continue on error
            });

            const insertedCount = result.length;
            const duration = Date.now() - startTime;
            this.stats.inserted += insertedCount;
            this.stats.totalTime += duration;

            const samplingRate = (this.stats.sampled / this.stats.received * 100).toFixed(1);
            console.log(
                `✅ Batch: ${insertedCount}/${batchSize} in ${duration}ms | ` +
                `Total: ${this.stats.inserted}/${this.stats.received} | ` +
                `Sampled: ${samplingRate}%`
            );

            return insertedCount;
        } catch (err) {
            const duration = Date.now() - startTime;
            this.stats.failed += batchSize;
            this.stats.totalTime += duration;

            console.error(
                `❌ Batch insert error: ${err.message} (${batchSize} records, ${duration}ms)`
            );

            // Partial success handling
            if (err.insertedIds && err.insertedIds.length > 0) {
                this.stats.inserted += err.insertedIds.length;
                console.log(
                    `⚠️ Partial success: ${err.insertedIds.length} records inserted`
                );
            }

            // Re-queue failed records
            this.buffer.unshift(...batch);
            throw err;
        }
    }

    async stop() {
        clearInterval(this.flushTimer);
        if (this.buffer.length > 0) {
            console.log(`📦 Final flush: ${this.buffer.length} records`);
            await this.flush();
        }
        this.printStats();
    }

    printStats() {
        const avgTime = this.stats.totalTime / Math.max(1, this.stats.inserted);
        const samplingRate = (this.stats.sampled / this.stats.received * 100).toFixed(1);
        console.log(`\n📊 Final Statistics:`);
        console.log(`   Received: ${this.stats.received}`);
        console.log(`   Inserted: ${this.stats.inserted}`);
        console.log(`   Sampled Out: ${this.stats.sampled} (${samplingRate}%)`);
        console.log(`   Failed: ${this.stats.failed}`);
        console.log(`   Avg Time per Insert: ${avgTime.toFixed(2)}ms`);
        console.log(`   Total Time: ${this.stats.totalTime}ms`);
    }
}

// ========== CONSUMER INITIALIZATION ==========
const batcher = new TelemetryBatcher(
    parseInt(process.env.BATCH_SIZE) || 1000,
    parseInt(process.env.FLUSH_INTERVAL_MS) || 5000
);

const CONSUMER_ID = `telemetry-worker-${process.pid}`;
let mongoConnected = false;
let consumerRunning = false;

const connectAndConsume = async () => {
    try {
        // ========== CONNECT MONGODB ==========
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/utm", {
            maxPoolSize: 50,
            minPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });
        mongoConnected = true;
        console.log("✅ MongoDB connected");

        // ========== CONNECT REDIS ==========
        await redisClientAsync.connect();
        console.log("✅ Redis connected");

        // ========== CREATE CONSUMER GROUP ==========
        await streamOps.createConsumerGroup();
        console.log("✅ Redis Streams consumer group initialized");

        // ========== CONSUME MESSAGES FROM REDIS STREAM ==========
        consumerRunning = true;
        console.log(`✅ Telemetry consumer started (ID: ${CONSUMER_ID})`);

        const consume = async () => {
            while (consumerRunning) {
                try {
                    // Read messages from stream with blocking
                    const messages = await streamOps.readStream(CONSUMER_ID, 10, 1000);

                    if (messages && messages.length > 0) {
                        for (const streamKeyAndMessages of messages) {
                            const { messages: streamMessages } = streamKeyAndMessages;

                            for (const message of streamMessages) {
                                try {
                                    const { id, message: msgData } = message;
                                    const data = msgData;

                                    // Transform to telemetry document
                                    const telemetryDoc = {
                                        drone: data.droneId,
                                        flightSession: data.sessionId || null,
                                        timestamp: new Date(parseInt(data.timestamp) || Date.now()),
                                        location: {
                                            type: "Point",
                                            coordinates: [parseFloat(data.lng), parseFloat(data.lat)], // GeoJSON [lng, lat]
                                        },
                                        altitude: parseFloat(data.alt) || 0,
                                        speed: parseFloat(data.speed) || 0,
                                        heading: parseFloat(data.heading) || 0,
                                        batteryLevel: parseFloat(data.batteryLevel) || 0,
                                    };

                                    // Add to buffer
                                    batcher.add(telemetryDoc);

                                    // Acknowledge message
                                    await streamOps.ackMessage(id);

                                } catch (err) {
                                    console.error(
                                        `❌ Error processing message:`,
                                        err.message
                                    );
                                }
                            }
                        }
                    }

                    // Stream trimming is now handled by periodic interval below

                } catch (err) {
                    if (consumerRunning) {
                        console.error("❌ Consumer error:", err.message);
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                }
            }
        };

        consume().catch(err => {
            if (consumerRunning) {
                console.error("❌ Unexpected consumer error:", err.message);
                process.exit(1);
            }
        });

        // ========== PERIODIC STREAM TRIMMING ==========
        // Trim every 5 seconds instead of every 10k messages
        setInterval(async () => {
            try {
                const streamLen = await streamOps.getStreamLength();
                const MAX_STREAM_SIZE = 20000;  // Keep max 20k messages in buffer

                if (streamLen > MAX_STREAM_SIZE) {
                    console.log(`📊 Stream size: ${streamLen} → trimming to ${MAX_STREAM_SIZE}`);
                    await streamOps.trimStream(MAX_STREAM_SIZE);
                }
            } catch (err) {
                console.error("Trim error:", err.message);
            }
        }, 5000);

    } catch (err) {
        console.error("❌ Consumer/MongoDB error:", err.message);
        console.log("🔄 Retrying in 5 seconds...");
        setTimeout(connectAndConsume, 5000);
    }
};

// ========== GRACEFUL SHUTDOWN ==========
const shutdown = async () => {
    console.log("\n📛 Shutting down Telemetry Worker...");
    consumerRunning = false;

    try {
        // Final flush
        await batcher.stop();

        // Disconnect Redis
        if (redisClientAsync) {
            await redisClientAsync.quit();
            console.log("✅ Redis disconnected");
        }

        // Disconnect MongoDB
        if (mongoConnected) {
            await mongoose.connection.close();
            console.log("✅ MongoDB disconnected");
        }

        console.log("✅ Telemetry Worker shut down successfully");
        process.exit(0);
    } catch (err) {
        console.error("Error during shutdown:", err.message);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ========== START WORKER ==========
console.log("🚀 Starting Telemetry Worker (Redis Streams)...");
connectAndConsume();
