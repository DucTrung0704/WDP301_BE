const redis = require("redis");

/**
 * Redis Client Configuration
 * Used for caching + telemetry streaming (Redis Streams)
 */
const redisClient = redis.createClient({
    socket: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                return false;
            }
            return Math.min(retries * 100, 3000);
        },
    },
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0"),
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
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
        if (!redisClientAsync.isOpen) {
            await redisClientAsync.connect();
        }
    } catch (err) {
        console.error("Failed to connect Redis clients:", err);
    }
})();

const ensureRedisReady = () => {
    if (!redisClient.isOpen || !redisClient.isReady) {
        return false;
    }
    return true;
};

const ensureStreamClientReady = async () => {
    if (!redisClientAsync.isOpen) {
        await redisClientAsync.connect();
    }
};

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

    /**
     * Mock drone latest location (for nearby display simulation)
     * Key: mock:drone:{id}:location
     * Value: JSON { droneId, lat, lng, alt, speed, heading, ts }
     */
    mockDroneLocation: (id) => `mock:drone:${id}:location`,
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
            if (!ensureRedisReady()) return false;
            const key = REDIS_KEYS.droneLocation(droneId);
            const value = JSON.stringify({
                ...locationData,
                droneId,
                ts: Date.now(),
            });
            await redisClient.setEx(key, ttlSeconds, value);
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
            if (!ensureRedisReady()) return null;
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
            if (!ensureRedisReady()) return [];
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
            if (!ensureRedisReady()) return false;
            const key = REDIS_KEYS.flightPlan(planId);
            const value = JSON.stringify(planData);
            await redisClient.setEx(key, ttlSeconds, value);
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
            if (!ensureRedisReady()) return null;
            const key = REDIS_KEYS.flightPlan(planId);
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error("Cache get flight plan error:", err);
            return null;
        }
    },

    /**
     * Set mock drone location with TTL
     */
    setMockDroneLocation: async (id, locationData, ttlSeconds = 3600) => {
        try {
            if (!ensureRedisReady()) return false;
            const key = REDIS_KEYS.mockDroneLocation(id);
            const value = JSON.stringify({
                ...locationData,
                droneId: id,
                ts: Date.now(),
            });
            await redisClient.setEx(key, ttlSeconds, value);
            return true;
        } catch (err) {
            console.error("Cache set mock drone error:", err);
            return false;
        }
    },

    /**
     * Get all mock drone locations
     */
    getAllMockDroneLocations: async () => {
        try {
            if (!ensureRedisReady()) return [];
            const pattern = "mock:drone:*:location";
            const keys = await redisClient.keys(pattern);

            if (keys.length === 0) return [];

            const locations = await Promise.all(
                keys.map((key) => redisClient.get(key))
            );

            return locations
                .filter((loc) => loc !== null)
                .map((loc) => JSON.parse(loc));
        } catch (err) {
            console.error("Cache get all mock drones error:", err);
            return [];
        }
    },

    /**
     * Invalidate cache
     */
    invalidate: async (pattern) => {
        try {
            if (!ensureRedisReady()) return 0;
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
            await ensureStreamClientReady();
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
            await ensureStreamClientReady();
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
            await ensureStreamClientReady();
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
            await ensureStreamClientReady();
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
            await ensureStreamClientReady();
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
            await ensureStreamClientReady();
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
            await ensureStreamClientReady();
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
