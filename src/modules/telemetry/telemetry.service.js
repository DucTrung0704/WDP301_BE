const Telemetry = require("./telemetry.model");
const FlightSession = require("../flightSession/flightSession.model");
const { runInflightChecks } = require("../conflict/inflightDetection.service");

/**
 * Process incoming telemetry data
 * Save to DB + trigger in-flight conflict detection checks
 */
async function processTelemetry(sessionId, telemetryData) {
  const session = await FlightSession.findById(sessionId).populate("drone");
  if (!session) throw new Error("Flight session not found");

  if (session.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot receive telemetry for session with status "${session.status}"`,
    );
  }

  // Save telemetry record
  const telemetry = await Telemetry.create({
    drone: session.drone._id,
    flightSession: session._id,
    timestamp: new Date(),
    location: {
      type: "Point",
      coordinates: [telemetryData.lng, telemetryData.lat], // GeoJSON [lng, lat]
    },
    altitude: telemetryData.altitude,
    speed: telemetryData.speed || 0,
    heading: telemetryData.heading || 0,
    batteryLevel: telemetryData.batteryLevel,
  });

  // Trigger in-flight checks (async, don't block telemetry save)
  runInflightChecks(session, telemetry).catch((err) => {
    console.error("In-flight check error:", err.message);
  });

  return telemetry;
}

/**
 * Get telemetry data for a session with pagination
 */
async function getSessionTelemetry(sessionId, options = {}) {
  const { page = 1, limit = 100 } = options;
  const skip = (page - 1) * limit;

  const [data, totalCount] = await Promise.all([
    Telemetry.find({ flightSession: sessionId })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(limit),
    Telemetry.countDocuments({ flightSession: sessionId }),
  ]);

  return { data, totalCount };
}

module.exports = {
  processTelemetry,
  getSessionTelemetry,
};
