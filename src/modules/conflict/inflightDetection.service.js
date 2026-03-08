const FlightSession = require("../flightSession/flightSession.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const ConflictEvent = require("./conflictEvent.model");
const Zone = require("../../../models/zone.model");
const Telemetry = require("../telemetry/telemetry.model");
const { createAlert } = require("../alert/alert.service");
const config = require("../../config/conflictConfig");
const {
  haversineDistance,
  interpolatePosition,
  determineSeverity,
} = require("./conflictDetection.service");

/**
 * Run all in-flight checks when new telemetry arrives
 * @param {Object} session - FlightSession document (populated with drone)
 * @param {Object} telemetry - Telemetry document just saved
 */
async function runInflightChecks(session, telemetry) {
  const currentPos = {
    lat: telemetry.location.coordinates[1],
    lng: telemetry.location.coordinates[0],
    altitude: telemetry.altitude,
  };

  // Run checks in parallel
  await Promise.allSettled([
    proximityCheck(session, telemetry, currentPos),
    zoneViolationCheck(session, telemetry, currentPos),
    session.sessionType === "PLANNED" ?
      deviationCheck(session, telemetry, currentPos)
    : Promise.resolve(), // Skip for FREE_FLIGHT
    batteryCheck(session, telemetry),
  ]);
}

/**
 * 1. Proximity Check — compare with all other IN_PROGRESS sessions
 */
async function proximityCheck(session, telemetry, currentPos) {
  const { D_MIN, H_MIN } = config.pairwise;

  // Get latest telemetry from all other active sessions
  const otherSessions = await FlightSession.find({
    _id: { $ne: session._id },
    status: "IN_PROGRESS",
  });

  if (otherSessions.length === 0) return;

  for (const otherSession of otherSessions) {
    // Get latest telemetry of the other drone
    const otherTelemetry = await Telemetry.findOne({
      flightSession: otherSession._id,
    }).sort({ timestamp: -1 });

    if (!otherTelemetry) continue;

    const otherPos = {
      lat: otherTelemetry.location.coordinates[1],
      lng: otherTelemetry.location.coordinates[0],
      altitude: otherTelemetry.altitude,
    };

    const dXY = haversineDistance(
      currentPos.lat,
      currentPos.lng,
      otherPos.lat,
      otherPos.lng,
    );
    const dZ = Math.abs(currentPos.altitude - otherPos.altitude);

    if (dXY < D_MIN && dZ < H_MIN) {
      const severity = determineSeverity(dXY, dZ);

      // Create ConflictEvent
      const conflictEvent = await ConflictEvent.create({
        flightPlans: [session.flightPlan, otherSession.flightPlan].filter(
          Boolean,
        ),
        flightSession: session._id,
        detectedAt: new Date(),
        predictedCollisionTime: new Date(),
        severity,
        location: telemetry.location,
        altitude: (currentPos.altitude + otherPos.altitude) / 2,
        detectionMethod: "REALTIME",
        horizontalDistance: Math.round(dXY * 100) / 100,
        verticalDistance: Math.round(dZ * 100) / 100,
        status: "ACTIVE",
      });

      // Create Alert
      await createAlert({
        flightSession: session._id,
        drone: session.drone._id || session.drone,
        type: "CONFLICT",
        severity,
        message: `Proximity alert: drone within ${Math.round(dXY)}m horizontal, ${Math.round(dZ)}m vertical`,
        location: telemetry.location,
        altitude: currentPos.altitude,
        data: {
          conflictEventId: conflictEvent._id,
          otherSessionId: otherSession._id,
          otherDroneId: otherSession.drone,
          horizontalDistance: Math.round(dXY * 100) / 100,
          verticalDistance: Math.round(dZ * 100) / 100,
        },
      });
    }
  }
}

/**
 * 2. Zone Violation Check — check if current position is in no-fly/restricted zone
 */
async function zoneViolationCheck(session, telemetry, currentPos) {
  const violatedZones = await Zone.find({
    status: "active",
    geometry: {
      $geoIntersects: {
        $geometry: {
          type: "Point",
          coordinates: [currentPos.lng, currentPos.lat],
        },
      },
    },
  });

  for (const zone of violatedZones) {
    // Check altitude overlap
    if (
      currentPos.altitude < zone.minAltitude ||
      currentPos.altitude > zone.maxAltitude
    ) {
      continue;
    }

    // Check time validity
    const now = new Date();
    const zoneStart = zone.effectiveFrom || new Date(0);
    const zoneEnd = zone.effectiveTo || new Date("2099-12-31");
    if (now < zoneStart || now > zoneEnd) continue;

    const severity = zone.type === "no_fly" ? "CRITICAL" : "HIGH";

    await createAlert({
      flightSession: session._id,
      drone: session.drone._id || session.drone,
      type: "ZONE_VIOLATION",
      severity,
      message: `Zone violation: entered ${zone.type} zone "${zone.name}"`,
      location: telemetry.location,
      altitude: currentPos.altitude,
      data: {
        zoneId: zone._id,
        zoneName: zone.name,
        zoneType: zone.type,
      },
    });
  }
}

/**
 * 3. Deviation Check — compare actual vs planned position (PLANNED only)
 */
async function deviationCheck(session, telemetry, currentPos) {
  if (!session.flightPlan) return;

  const plan = await FlightPlan.findById(session.flightPlan);
  if (!plan || !plan.waypoints || plan.waypoints.length < 2) return;

  const { DEVIATION_THRESHOLD } = config.inflight;

  // Interpolate expected position at current time
  const expectedPos = interpolatePosition(plan.waypoints, new Date());
  if (!expectedPos) return; // Outside planned time window

  const deviation = haversineDistance(
    currentPos.lat,
    currentPos.lng,
    expectedPos.latitude,
    expectedPos.longitude,
  );

  if (deviation > DEVIATION_THRESHOLD) {
    await createAlert({
      flightSession: session._id,
      drone: session.drone._id || session.drone,
      type: "DEVIATION",
      severity: deviation > DEVIATION_THRESHOLD * 2 ? "HIGH" : "MEDIUM",
      message: `Route deviation: ${Math.round(deviation)}m from planned trajectory`,
      location: telemetry.location,
      altitude: currentPos.altitude,
      data: {
        expectedLat: expectedPos.latitude,
        expectedLng: expectedPos.longitude,
        actualLat: currentPos.lat,
        actualLng: currentPos.lng,
        deviationDistance: Math.round(deviation * 100) / 100,
      },
    });
  }
}

/**
 * 4. Battery Check
 */
async function batteryCheck(session, telemetry) {
  if (telemetry.batteryLevel == null) return;

  const { BATTERY_LOW_THRESHOLD } = config.inflight;

  if (telemetry.batteryLevel < BATTERY_LOW_THRESHOLD) {
    await createAlert({
      flightSession: session._id,
      drone: session.drone._id || session.drone,
      type: "BATTERY_LOW",
      severity: telemetry.batteryLevel < 10 ? "CRITICAL" : "HIGH",
      message: `Low battery: ${telemetry.batteryLevel}% remaining`,
      location: telemetry.location,
      altitude: telemetry.altitude,
      data: {
        batteryLevel: telemetry.batteryLevel,
        threshold: BATTERY_LOW_THRESHOLD,
      },
    });
  }
}

module.exports = {
  runInflightChecks,
};
