const Telemetry = require("./telemetry.model");
const FlightSession = require("../flightSession/flightSession.model");
const mongoose = require("mongoose");
const { runInflightChecks } = require("../conflict/inflightDetection.service");

// Sampling configuration
const SAMPLING_CONFIG = {
  ratio: parseInt(process.env.TELEMETRY_SAMPLING_RATIO) || 10, // Store every 10th data point
  minInterval: parseInt(process.env.TELEMETRY_MIN_INTERVAL) || 1000, // Min 1 second between stored points
};

// Rate limiter per drone (tracks when last telemetry was stored)
const lastTelemetryTimes = new Map();

/**
 * Determine if telemetry should be stored based on sampling strategy
 * Stores every Nth point + ensures minimum time interval between points
 */
function shouldSampleTelemetry(droneId) {
  const now = Date.now();
  const lastTime = lastTelemetryTimes.get(droneId) || 0;
  const timeDelta = now - lastTime;

  // Minimum interval must pass first
  if (timeDelta < SAMPLING_CONFIG.minInterval) {
    return false;
  }

  // Reset the window regardless of random outcome to prevent starvation:
  // without this, failed random checks leave lastTelemetryTimes unchanged,
  // causing all subsequent calls to keep retrying the random gate on the
  // same stale window, which can result in data never being saved.
  lastTelemetryTimes.set(droneId, now);

  // Random sampling (approximate 1/ratio points saved)
  return Math.random() * SAMPLING_CONFIG.ratio < 1;
}

/**
 * Process incoming telemetry data
 * Save to DB + trigger in-flight conflict detection checks
 * With intelligent sampling to reduce database load
 */
async function processTelemetry(sessionId, telemetryData, skipSampling = false) {
  const session = await FlightSession.findById(sessionId).populate("drone");
  if (!session) throw new Error("Flight session not found");

  if (session.status !== "IN_PROGRESS") {
    throw new Error(
      `Cannot receive telemetry for session with status "${session.status}"`,
    );
  }

  // Apply sampling (unless explicitly disabled)
  const isSampled = !skipSampling && !shouldSampleTelemetry(session.drone._id);

  if (isSampled) {
    // Still trigger conflict checks but don't save to DB for frequency reduction
    runInflightChecks(session, {
      drone: session.drone._id,
      location: {
        type: "Point",
        coordinates: [telemetryData.lng, telemetryData.lat],
      },
      altitude: telemetryData.altitude,
      speed: telemetryData.speed || 0,
      heading: telemetryData.heading || 0,
      batteryLevel: telemetryData.batteryLevel,
    }).catch((err) => {
      console.error("In-flight check error:", err.message);
    });
    return null; // Sampled out
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
    isSampled: false,
  });

  // Trigger in-flight checks (async, don't block telemetry save)
  runInflightChecks(session, telemetry).catch((err) => {
    console.error("In-flight check error:", err.message);
  });

  return telemetry;
}

/**
 * Get telemetry data for a session with pagination and optional filtering
 */
async function getSessionTelemetry(sessionId, options = {}) {
  const {
    page = 1,
    limit = 100,
    startTime = null,
    endTime = null,
  } = options;
  const skip = (page - 1) * limit;

  // Build query
  const query = { flightSession: sessionId };
  if (startTime || endTime) {
    query.timestamp = {};
    if (startTime) query.timestamp.$gte = new Date(startTime);
    if (endTime) query.timestamp.$lte = new Date(endTime);
  }

  const [data, totalCount] = await Promise.all([
    Telemetry.find(query)
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(limit)
      .lean(), // Use lean() for faster reads
    Telemetry.countDocuments(query),
  ]);

  return {
    data,
    totalCount,
    page,
    limit,
    hasMore: skip + limit < totalCount,
  };
}

/**
 * Aggregate telemetry data for time ranges (for analytics/dashboards)
 * Returns min/max/avg values for each time bucket
 */
async function getAggregatedTelemetry(sessionId, bucketSizeMs = 60000) {
  return await Telemetry.aggregate([
    { $match: { flightSession: mongoose.Types.ObjectId(sessionId) } },
    {
      $group: {
        _id: {
          $toDate: {
            $multiply: [
              { $floor: { $divide: [{ $toDate: "$timestamp" }, bucketSizeMs] } },
              bucketSizeMs,
            ],
          },
        },
        avgAltitude: { $avg: "$altitude" },
        minAltitude: { $min: "$altitude" },
        maxAltitude: { $max: "$altitude" },
        avgSpeed: { $avg: "$speed" },
        maxSpeed: { $max: "$speed" },
        avgBattery: { $avg: "$batteryLevel" },
        minBattery: { $min: "$batteryLevel" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

module.exports = {
  processTelemetry,
  getSessionTelemetry,
  getAggregatedTelemetry,
};
