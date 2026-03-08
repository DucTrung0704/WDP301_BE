const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { processTelemetry } = require("../modules/telemetry/telemetry.service");
const { setWsBroadcast } = require("../modules/alert/alert.service");

// Map: sessionId → Set of WebSocket clients watching that session
const sessionWatchers = new Map();

/**
 * Initialize WebSocket server on existing HTTP server
 */
function init(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  console.log("WebSocket server initialized on /ws");

  // Setup broadcast function for alert service
  setWsBroadcast(broadcastToSession);

  wss.on("connection", (ws, req) => {
    let userId = null;
    let userRole = null;
    let authenticated = false;
    let watchingSession = null;

    // Try to authenticate from query param (ws://host/ws?token=xxx)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        userRole = decoded.role;
        authenticated = true;
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        ws.close(4001, "Invalid token");
        return;
      }
    }

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Handle auth via first message (alternative to query param)
        if (msg.type === "auth" && !authenticated) {
          try {
            const decoded = jwt.verify(msg.token, process.env.JWT_SECRET);
            userId = decoded.id;
            userRole = decoded.role;
            authenticated = true;
            ws.send(
              JSON.stringify({ type: "auth_success", userId, role: userRole }),
            );
          } catch (err) {
            ws.send(
              JSON.stringify({ type: "error", message: "Invalid token" }),
            );
            ws.close(4001, "Invalid token");
          }
          return;
        }

        if (!authenticated) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Not authenticated. Send auth message first.",
            }),
          );
          return;
        }

        // Handle telemetry data
        if (msg.type === "telemetry") {
          const { sessionId, data: telData } = msg;

          if (!sessionId || !telData) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "sessionId and data are required",
              }),
            );
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

          ws.send(
            JSON.stringify({
              type: "telemetry_ack",
              telemetryId: telemetry._id,
              timestamp: telemetry.timestamp,
            }),
          );
        }

        // Watch a session for alerts
        if (msg.type === "watch_session") {
          const { sessionId } = msg;

          // Unwatch previous session
          if (watchingSession) {
            const watchers = sessionWatchers.get(watchingSession);
            if (watchers) {
              watchers.delete(ws);
              if (watchers.size === 0) sessionWatchers.delete(watchingSession);
            }
          }

          // Watch new session
          watchingSession = sessionId;
          if (!sessionWatchers.has(sessionId)) {
            sessionWatchers.set(sessionId, new Set());
          }
          sessionWatchers.get(sessionId).add(ws);

          ws.send(JSON.stringify({ type: "watching", sessionId }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      }
    });

    ws.on("close", () => {
      // Cleanup watcher
      if (watchingSession) {
        const watchers = sessionWatchers.get(watchingSession);
        if (watchers) {
          watchers.delete(ws);
          if (watchers.size === 0) sessionWatchers.delete(watchingSession);
        }
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
    });

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to UTM WebSocket",
        authenticated,
      }),
    );
  });

  return wss;
}

/**
 * Broadcast message to all clients watching a specific session
 */
function broadcastToSession(sessionId, message) {
  const watchers = sessionWatchers.get(sessionId);
  if (!watchers || watchers.size === 0) return;

  const payload = JSON.stringify(message);
  for (const ws of watchers) {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(payload);
    }
  }
}

module.exports = { init };
