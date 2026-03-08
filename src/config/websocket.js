const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { processTelemetry } = require("../modules/telemetry/telemetry.service");
const { setWsBroadcast } = require("../modules/alert/alert.service");

let io; // Hold the socket.io server instance

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
        const { sessionId, data: telData } = msg;

        if (!sessionId || !telData) {
          socket.emit("error", { message: "sessionId and data are required" });
          return;
        }

        const telemetry = await processTelemetry(sessionId, {
          lat: telData.lat,
          lng: telData.lng,
          altitude: telData.altitude,
          speed: telData.speed,
          heading: telData.heading,
          batteryLevel: telData.batteryLevel,
        });

        socket.emit("telemetry_ack", {
          telemetryId: telemetry._id,
          timestamp: telemetry.timestamp,
        });
      } catch (err) {
        socket.emit("error", { message: err.message });
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

module.exports = { init };
