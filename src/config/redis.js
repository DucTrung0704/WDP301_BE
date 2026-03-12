const redis = require("redis");

/**
 * Redis Client Configuration
 * Used for caching + telemetry streaming (Redis Streams)
 */
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0"),
    retryStrategy: (options) => {
        if (options.error && options.error.code === "ECONNREFUSED") {
            return new Error("End of retry.");
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error("Retry time exhausted");
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    },
});

redisClient.on("error", (err) => {
    console.error("❌ Redis error:", err);
});

redisClient.on("connect", () => {
    console.log("✅ Redis connected");
});

redisClient.on("reconnecting", () => {
    console.log("🔄 Redis reconnecting...");
});

// Convert callback-based redis to promises for better compatibility
const redisClientAsync = redisClient.duplicate();
(async () => {
    try {
        await redisClientAsync.connect();
    } catch (err) {
        console.error("Failed to connect async Redis client:", err);
    }
})();

/**
 * Redis key patterns & stream names
 */
const REDIS_KEYS = {
    /**
     * Telemetry Stream (Redis Streams)
     * Used for telemetry message queue (replaces Kafka)
     */
    telemetryStream: "telemetry:stream",

    /**
     * Telemetry consumer group (for Redis Streams consumer groups)
     */
    telemetryGroup: "telemetry-consumer-group",

    /**
     * Latest drone location
     * Key: drone:{droneId}:location
     * Value: JSON { lat, lng, alt, speed, heading, batteryLevel, ts }
     */
    droneLocation: (droneId) => `drone:${droneId}:location`,

    /**
     * Flight session cache
     * Key: session:{sessionId}
     * Value: JSON flight session data
     */
    flightSession: (sessionId) => `session:${sessionId}`,

    /**
     * Flight plan cache
     * Key: flightplan:{planId}
     * Value: JSON flight plan data
     */
    flightPlan: (planId) => `flightplan:${planId}`,

    /**
     * Active drones cache
     * Key: drones:active
     * Value: SET of drone IDs
     */
    activeDrones: "drones:active",

    /**
     * Drone status
     * Key: drone:{droneId}:status
     * Value: STRING (IDLE, FLYING, CHARGING, etc)
     */
    droneStatus: (droneId) => `drone:${droneId}:status`,
};

/**
 * Cache operation helpers
 */
const cacheOps = {
    /**
     * Set drone latest location with TTL
     */
    setDroneLocation: async (droneId, locationData, ttlSeconds = 3600) => {
        try {
            const key = REDIS_KEYS.droneLocation(droneId);
            const value = JSON.stringify({
                ...locationData,
                ts: Date.now(),
            });
            await redisClient.setex(key, ttlSeconds, value);
            return true;
        } catch (err) {
            console.error("Cache set error:", err);
            return false;
        }
    },

    /**
     * Get drone latest location
     */
    getDroneLocation: async (droneId) => {
        try {
            const key = REDIS_KEYS.droneLocation(droneId);
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error("Cache get error:", err);
            return null;
        }
    },

    /**
     * Get all active drones
     */
    getAllDroneLocations: async () => {
        try {
            const pattern = "drone:*:location";
            const keys = await redisClient.keys(pattern);

            if (keys.length === 0) return [];

            const locations = await Promise.all(
                keys.map((key) => redisClient.get(key))
            );

            return locations
                .filter((loc) => loc !== null)
                .map((loc) => JSON.parse(loc));
        } catch (err) {
            console.error("Cache get all error:", err);
            return [];
        }
    },

    /**
     * Cache flight plan
     */
    cacheFlightPlan: async (planId, planData, ttlSeconds = 3600) => {
        try {
            const key = REDIS_KEYS.flightPlan(planId);
            const value = JSON.stringify(planData);
            await redisClient.setex(key, ttlSeconds, value);
            return true;
        } catch (err) {
            console.error("Cache flight plan error:", err);
            return false;
        }
    },

    /**
     * Get cached flight plan
     */
    getFlightPlan: async (planId) => {
        try {
            const key = REDIS_KEYS.flightPlan(planId);
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error("Cache get flight plan error:", err);
            return null;
        }
    },

    /**
     * Invalidate cache
     */
    invalidate: async (pattern) => {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(...keys);
                return keys.length;
            }
            return 0;
        } catch (err) {
            console.error("Cache invalidate error:", err);
            return 0;
        }
    },
};

/**
 * Stream operation helpers using Redis Streams (replaces Kafka)
 */
const streamOps = {
    /**
     * Write telemetry to Redis Stream
     */
    addTelemetry: async (telemetryData) => {
        try {
            const streamKey = REDIS_KEYS.telemetryStream;
            const streamId = await redisClientAsync.xAdd(streamKey, "*", {
                droneId: telemetryData.droneId,
                sessionId: telemetryData.sessionId || "",
                lat: String(telemetryData.lat),
                lng: String(telemetryData.lng),
                alt: String(telemetryData.alt || 0),
                speed: String(telemetryData.speed || 0),
                heading: String(telemetryData.heading || 0),
                batteryLevel: String(telemetryData.batteryLevel || 0),
                timestamp: String(telemetryData.timestamp || Date.now()),
                receivedAt: new Date().toISOString(),
                sourceGateway: telemetryData.sourceGateway || "",
                sourceUser: telemetryData.sourceUser || "",
            });
            return streamId;
        } catch (err) {
            console.error("Stream add error:", err.message);
            throw err;
        }
    },

    /**
     * Create consumer group if it doesn't exist
     */
    createConsumerGroup: async () => {
        try {
            const streamKey = REDIS_KEYS.telemetryStream;
            const groupName = REDIS_KEYS.telemetryGroup;

            try {
                await redisClientAsync.xGroupCreate(streamKey, groupName, "0", {
                    MKSTREAM: true,
                });
                console.log(`✅ Consumer group '${groupName}' created`);
            } catch (err) {
                if (err.message.includes("BUSYGROUP")) {
                    console.log(`⚠️ Consumer group '${groupName}' already exists`);
                } else {
                    throw err;
                }
            }
        } catch (err) {
            console.error("Create consumer group error:", err.message);
            throw err;
        }
    },

    /**
     * Read messages from stream (consumer group mode)
     */
    readStream: async (consumerId, count = 10, blockMs = 1000) => {
        try {
            const streamKey = REDIS_KEYS.telemetryStream;
            const groupName = REDIS_KEYS.telemetryGroup;

            const messages = await redisClientAsync.xReadGroup(
                {
                    key: streamKey,
                    group: groupName,
                    consumer: consumerId,
                },
                {
                    count: count,
                    block: blockMs,
                }
            );

            return messages || [];
        } catch (err) {
            console.error("Stream read error:", err.message);
            return [];
        }
    },

    /**
     * Acknowledge message processing
     */
    ackMessage: async (messageId) => {
        try {
            const streamKey = REDIS_KEYS.telemetryStream;
            const groupName = REDIS_KEYS.telemetryGroup;

            await redisClientAsync.xAck(streamKey, groupName, messageId);
        } catch (err) {
            console.error("Stream ack error:", err.message);
        }
    },

    /**
     * Get stream length
     */
    getStreamLength: async () => {
        try {
            const streamKey = REDIS_KEYS.telemetryStream;
            return await redisClientAsync.xLen(streamKey);
        } catch (err) {
            console.error("Stream length error:", err.message);
            return 0;
        }
    },

    /**
     * Get consumer group info
     */
    getGroupInfo: async () => {
        try {
            const streamKey = REDIS_KEYS.telemetryStream;
            const groupName = REDIS_KEYS.telemetryGroup;
            return await redisClientAsync.xInfoGroups(streamKey);
        } catch (err) {
            console.error("Group info error:", err.message);
            return [];
        }
    },

    /**
     * Trim stream to max length (retain last N messages)
     */
    trimStream: async (maxLen = 100000) => {
        try {
            const streamKey = REDIS_KEYS.telemetryStream;
            await redisClientAsync.xTrim(streamKey, "MAXLEN", "~", maxLen);
        } catch (err) {
            console.error("Stream trim error:", err.message);
        }
    },
};

module.exports = {
    redisClient,
    redisClientAsync,
    REDIS_KEYS,
    cacheOps,
    streamOps,
};
