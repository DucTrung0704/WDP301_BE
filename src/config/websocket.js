const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { cacheOps, streamOps, REDIS_KEYS } = require("./redis");
const { setWsBroadcast } = require("../modules/alert/alert.service");

let io; // Hold the socket.io server instance
let redisReady = false; // Redis connectivity flag

/**
 * Initialize Socket.IO server on existing HTTP server
 */
function init(httpServer) {
  io = new Server(httpServer, {
    path: "/ws",
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
    },
  });

  console.log("Socket.IO server initialized on /ws");

  // Initialize Redis streams
  initializeRedisStreams();

  // Setup broadcast function for alert service
  setWsBroadcast(broadcastToSession);

  // Authentication Middleware
  io.use((socket, next) => {
    // Try to get token from auth object (standard) or query string (fallback)
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Attach user info to the socket object
      socket.user = {
        id: decoded.id,
        role: decoded.role,
      };
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket client connected [${socket.id}] - User: ${socket.user.id}`,
    );

    // Send welcome message
    socket.emit("connected", {
      message: "Connected to UTM Socket.IO",
      userId: socket.user.id,
      role: socket.user.role,
    });

    // Handle telemetry data
    socket.on("telemetry", async (msg) => {
      try {
        const { droneId, lat, lng, alt, speed, heading, batteryLevel, timestamp } = msg;

        // ========== VALIDATION ==========
        if (!droneId || lat === undefined || lng === undefined) {
          socket.emit("error", { message: "Missing required fields: droneId, lat, lng" });
          return;
        }

        // ========== CACHE LATEST LOCATION IN REDIS ==========
        await cacheOps.setDroneLocation(droneId, {
          lat,
          lng,
          alt: alt || 0,
          speed: speed || 0,
          heading: heading || 0,
          batteryLevel: batteryLevel || 0,
        }, 3600); // 1 hour TTL

        // ========== SEND TO REDIS STREAM (NON-BLOCKING) ==========
        if (redisReady) {
          streamOps
            .addTelemetry({
              droneId,
              lat,
              lng,
              alt: alt || 0,
              speed: speed || 0,
              heading: heading || 0,
              batteryLevel: batteryLevel || 0,
              timestamp: timestamp || Date.now(),
              sourceGateway: socket.id,
              sourceUser: socket.user.id,
            })
            .catch((err) => {
              console.error(`❌ Failed to add telemetry to Redis stream for drone ${droneId}:`, err.message);
              // Optional: implement retry queue or fallback storage
            });
        } else {
          console.warn("⚠️ Redis streams not ready, message may be buffered");
        }

        // ========== SEND ACK IMMEDIATELY (< 5ms) ==========
        socket.emit("telemetry_ack", {
          droneId,
          status: "received",
          ts: Date.now(),
        });

      } catch (err) {
        console.error("❌ Telemetry error:", err.message);
        socket.emit("error", { message: "Processing failed" });
      }
    });

    // Watch a session for alerts
    socket.on("watch_session", (msg) => {
      try {
        const { sessionId } = msg;

        if (!sessionId) return;

        // Optionally, leave the previous room if we only allow watching one session at a time
        if (socket.watchingSession) {
          socket.leave(socket.watchingSession);
        }

        // Join the new room corresponding to the sessionId
        socket.join(sessionId);
        socket.watchingSession = sessionId; // Store the current watched session

        socket.emit("watching", { sessionId });
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket client disconnected [${socket.id}]`);
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err.message);
    });
  });

  return io;
}

/**
 * Broadcast message to all clients watching a specific session
 */
function broadcastToSession(sessionId, message) {
  if (io) {
    // Socket.IO automatically handles broadcasting to the "room" (sessionId)
    io.to(sessionId).emit("alert", message);
  }
}

/**
 * Initialize Redis Streams
 */
async function initializeRedisStreams() {
  try {
    await streamOps.createConsumerGroup();
    redisReady = true;
    console.log("✅ Redis Streams initialized");
  } catch (err) {
    console.error("❌ Failed to initialize Redis Streams:", err.message);
    // Retry after 5 seconds
    setTimeout(initializeRedisStreams, 5000);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log("\n📛 Shutting down Socket.IO...");
  try {
    if (io) {
      io.close();
      console.log("✅ Socket.IO closed");
    }
  } catch (err) {
    console.error("Error during shutdown:", err);
  }
}

module.exports = { init, shutdown };
