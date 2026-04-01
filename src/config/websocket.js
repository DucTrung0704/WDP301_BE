const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { cacheOps, streamOps, REDIS_KEYS } = require("./redis");
const { setWsBroadcast } = require("../modules/alert/alert.service");
const { runInflightChecks } = require("../modules/conflict/inflightDetection.service");
const { processTelemetry } = require("../modules/telemetry/telemetry.service");
const FlightSession = require("../modules/flightSession/flightSession.model");
const FlightPlan = require("../modules/flightPlan/flightPlan.model");
const { getNearbyDrones } = require("../modules/nearby/nearby.service");

const NEARBY_RADIUS_M = parseInt(process.env.NEARBY_RADIUS_M) || 1000;
const NEARBY_PUSH_MS = parseInt(process.env.NEARBY_PUSH_INTERVAL_MS) || 1000;

let io; // Hold the socket.io server instance
let redisReady = false; // Redis connectivity flag
const TELEMETRY_DIAG_LOG = process.env.TELEMETRY_DIAG_LOG !== "false";

function diagTelemetry(branch, info = {}) {
  if (!TELEMETRY_DIAG_LOG) return;

  const payload = {
    branch,
    ...info,
    ts: new Date().toISOString(),
  };

  console.log(`[TELEMETRY_DIAG] ${JSON.stringify(payload)}`);
}

/**
 * Trigger in-flight conflict detection asynchronously
 * Called from WebSocket path so realtime safety checks run without blocking ACK
 */
async function triggerConflictCheck(sessionId, locationData) {
  const session = await FlightSession.findById(sessionId).populate("drone");
  if (!session || session.status !== "IN_PROGRESS") return;

  const telemetryLike = {
    location: {
      type: "Point",
      coordinates: [locationData.lng, locationData.lat],
    },
    altitude: locationData.alt || 0,
    speed: locationData.speed || 0,
    heading: locationData.heading || 0,
    batteryLevel: locationData.batteryLevel || 0,
  };

  await runInflightChecks(session, telemetryLike);
}

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
        const { droneId, sessionId, lat, lng, alt, speed, heading, batteryLevel, timestamp } = msg;
        const telemetryTs = timestamp || Date.now();

        // ========== VALIDATION ==========
        if (!droneId || lat === undefined || lng === undefined) {
          diagTelemetry("SKIP", {
            reason: "missing_required_fields",
            socketId: socket.id,
            userId: socket.user.id,
            droneId: droneId || null,
            sessionId: sessionId || null,
          });
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
          diagTelemetry("REDIS_STREAM", {
            reason: "redis_ready",
            socketId: socket.id,
            userId: socket.user.id,
            droneId,
            sessionId: sessionId || null,
            telemetryTimestamp: telemetryTs,
          });

          streamOps
            .addTelemetry({
              droneId,
              sessionId: sessionId || "",
              lat,
              lng,
              alt: alt || 0,
              speed: speed || 0,
              heading: heading || 0,
              batteryLevel: batteryLevel || 0,
              timestamp: telemetryTs,
              sourceGateway: socket.id,
              sourceUser: socket.user.id,
            })
            .catch((err) => {
              console.error(`❌ Failed to add telemetry to Redis stream for drone ${droneId}:`, err.message);
              // Fallback: save directly to DB when Redis stream write fails
              if (sessionId) {
                diagTelemetry("FALLBACK_DB", {
                  reason: "redis_stream_add_failed",
                  socketId: socket.id,
                  userId: socket.user.id,
                  droneId,
                  sessionId,
                  error: err.message,
                });

                processTelemetry(sessionId, { lat, lng, altitude: alt || 0, speed: speed || 0, heading: heading || 0, batteryLevel }, true)
                  .catch((e) => console.error(`❌ Fallback DB save failed for session ${sessionId}:`, e.message));
              } else {
                diagTelemetry("SKIP", {
                  reason: "redis_stream_add_failed_and_no_sessionId_for_fallback",
                  socketId: socket.id,
                  userId: socket.user.id,
                  droneId,
                  sessionId: null,
                  error: err.message,
                });
              }
            });
        } else {
          // Redis not ready — save directly to DB so data is never lost
          console.warn("⚠️ Redis not ready, saving telemetry directly to DB");
          if (sessionId) {
            diagTelemetry("FALLBACK_DB", {
              reason: "redis_not_ready",
              socketId: socket.id,
              userId: socket.user.id,
              droneId,
              sessionId,
              telemetryTimestamp: telemetryTs,
            });

            processTelemetry(sessionId, { lat, lng, altitude: alt || 0, speed: speed || 0, heading: heading || 0, batteryLevel }, true)
              .catch((err) => console.error(`❌ Direct DB telemetry save failed for session ${sessionId}:`, err.message));
          } else {
            diagTelemetry("SKIP", {
              reason: "redis_not_ready_and_no_sessionId_for_fallback",
              socketId: socket.id,
              userId: socket.user.id,
              droneId,
              sessionId: null,
              telemetryTimestamp: telemetryTs,
            });
          }
        }

        // ========== SEND ACK IMMEDIATELY (< 5ms) ==========
        socket.emit("telemetry_ack", {
          droneId,
          status: "received",
          ts: Date.now(),
        });

        // ========== ASYNC CONFLICT DETECTION (non-blocking) ==========
        if (sessionId) {
          triggerConflictCheck(sessionId, { lat, lng, alt: alt || 0, speed: speed || 0, heading: heading || 0, batteryLevel: batteryLevel || 0 })
            .catch((err) => console.error(`❌ Conflict check failed for session ${sessionId}:`, err.message));
        }

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
      clearInterval(socket.nearbyInterval);
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err.message);
    });

    // ── Nearby Drones (during flight) ────────────────────────────────────────
    // Client sends: { sessionId, lat?, lng? }
    // Server pushes: nearby_drones every NEARBY_PUSH_MS
    socket.on("subscribe_nearby", async (msg) => {
      try {
        const { sessionId, lat, lng } = msg || {};

        if (!sessionId) {
          socket.emit("error", { message: "subscribe_nearby: sessionId is required" });
          return;
        }

        const session = await FlightSession.findById(sessionId).populate("drone");
        if (!session) {
          socket.emit("error", { message: "Flight session not found" });
          return;
        }

        if (session.pilot.toString() !== socket.user.id.toString()) {
          socket.emit("error", { message: "Forbidden: not your session" });
          return;
        }

        // Resolve centre coordinates
        let centreLat = lat;
        let centreLng = lng;

        if (centreLat == null || centreLng == null) {
          // Fall back to latest cached drone position
          const droneIdStr =
            session.drone._id?.toString() || session.drone.toString();
          const cached = await cacheOps.getDroneLocation(droneIdStr);
          if (!cached) {
            socket.emit("error", {
              message:
                "subscribe_nearby: lat/lng required — no telemetry cached yet",
            });
            return;
          }
          centreLat = cached.lat;
          centreLng = cached.lng;
        }

        const droneId =
          session.drone._id?.toString() || session.drone.toString();

        // Stop any existing nearby interval first
        clearInterval(socket.nearbyInterval);

        const pushNearby = async () => {
          try {
            // Use latest cached position when available (drone is moving)
            const latest = await cacheOps.getDroneLocation(droneId);
            const queryLat = latest ? latest.lat : centreLat;
            const queryLng = latest ? latest.lng : centreLng;

            const drones = await getNearbyDrones(
              queryLat,
              queryLng,
              NEARBY_RADIUS_M,
              [droneId],
            );

            socket.emit("nearby_drones", {
              drones,
              count: drones.length,
              timestamp: Date.now(),
            });
          } catch (err) {
            console.error("nearby push error:", err.message);
          }
        };

        // Push immediately, then on interval
        await pushNearby();
        socket.nearbyInterval = setInterval(pushNearby, NEARBY_PUSH_MS);

        socket.emit("nearby_subscribed", { sessionId, radiusM: NEARBY_RADIUS_M });
      } catch (err) {
        console.error("subscribe_nearby error:", err.message);
        socket.emit("error", { message: err.message });
      }
    });

    // ── Nearby Drones (pre-flight, FLEET_OPERATOR only) ──────────────────────
    // Client sends: { flightPlanId, lat, lng }
    // Server pushes: nearby_drones every NEARBY_PUSH_MS from the given position
    socket.on("subscribe_plan_nearby", async (msg) => {
      try {
        if (socket.user.role !== "FLEET_OPERATOR") {
          socket.emit("error", {
            message: "subscribe_plan_nearby: FLEET_OPERATOR only",
          });
          return;
        }

        const { flightPlanId, lat, lng } = msg || {};

        if (!flightPlanId || lat == null || lng == null) {
          socket.emit("error", {
            message:
              "subscribe_plan_nearby: flightPlanId, lat, lng are required",
          });
          return;
        }

        const plan = await FlightPlan.findById(flightPlanId);
        if (!plan) {
          socket.emit("error", { message: "Flight plan not found" });
          return;
        }

        if (plan.pilot.toString() !== socket.user.id.toString()) {
          socket.emit("error", { message: "Forbidden: not your flight plan" });
          return;
        }

        // Stop any existing nearby interval first
        clearInterval(socket.nearbyInterval);

        const pushNearby = async () => {
          try {
            const drones = await getNearbyDrones(lat, lng, NEARBY_RADIUS_M);
            socket.emit("nearby_drones", {
              drones,
              count: drones.length,
              timestamp: Date.now(),
            });
          } catch (err) {
            console.error("plan nearby push error:", err.message);
          }
        };

        await pushNearby();
        socket.nearbyInterval = setInterval(pushNearby, NEARBY_PUSH_MS);

        socket.emit("nearby_subscribed", {
          flightPlanId,
          radiusM: NEARBY_RADIUS_M,
        });
      } catch (err) {
        console.error("subscribe_plan_nearby error:", err.message);
        socket.emit("error", { message: err.message });
      }
    });

    // ── Unsubscribe Nearby ────────────────────────────────────────────────────
    socket.on("unsubscribe_nearby", () => {
      clearInterval(socket.nearbyInterval);
      socket.nearbyInterval = null;
      socket.emit("nearby_unsubscribed", {});
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
