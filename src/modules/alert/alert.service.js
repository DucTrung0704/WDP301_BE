const Alert = require("./alert.model");

// WebSocket broadcaster — will be set by websocket.js init
let wsBroadcast = null;

function setWsBroadcast(broadcastFn) {
  wsBroadcast = broadcastFn;
}

/**
 * Create alert + broadcast via WebSocket
 */
async function createAlert(data) {
  const alert = await Alert.create(data);

  // Broadcast to connected clients watching this session
  if (wsBroadcast) {
    wsBroadcast(data.flightSession.toString(), {
      type: "alert",
      alert: {
        _id: alert._id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        location: alert.location,
        altitude: alert.altitude,
        data: alert.data,
        createdAt: alert.createdAt,
      },
    });
  }

  return alert;
}

/**
 * Acknowledge alert
 */
async function acknowledgeAlert(alertId) {
  const alert = await Alert.findById(alertId);
  if (!alert) throw new Error("Alert not found");

  if (alert.status !== "ACTIVE") {
    throw new Error(
      `Alert is already "${alert.status}". Only ACTIVE alerts can be acknowledged.`,
    );
  }

  alert.status = "ACKNOWLEDGED";
  await alert.save();

  return alert;
}

/**
 * Get alerts for a session
 */
async function getSessionAlerts(sessionId, options = {}) {
  const { type, status, page = 1, limit = 50 } = options;
  const filter = { flightSession: sessionId };

  if (type) filter.type = type;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;

  const [alerts, totalCount] = await Promise.all([
    Alert.find(filter)
      .populate("drone", "droneId serialNumber model")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Alert.countDocuments(filter),
  ]);

  return { alerts, totalCount };
}

module.exports = {
  createAlert,
  acknowledgeAlert,
  getSessionAlerts,
  setWsBroadcast,
};
