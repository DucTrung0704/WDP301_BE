const FlightSession = require("./flightSession.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const Drone = require("../../../models/drone.model");
const Telemetry = require("../telemetry/telemetry.model");

/**
 * Start planned session — requires APPROVED FlightPlan
 * Both INDIVIDUAL_OPERATOR and FLEET_OPERATOR can use this
 */
async function startPlannedSession(flightPlanId, userId) {
  const plan = await FlightPlan.findById(flightPlanId);
  if (!plan) throw new Error("Flight plan not found");

  if (plan.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this flight plan");
  }

  if (plan.status !== "APPROVED") {
    throw new Error(
      `Cannot start session: flight plan status is "${plan.status}". Only APPROVED plans can start sessions.`,
    );
  }

  const drone = await Drone.findById(plan.drone);
  if (!drone) throw new Error("Drone not found");

  if (drone.status !== "IDLE") {
    throw new Error(
      `Drone is currently "${drone.status}". Only IDLE drones can start a session.`,
    );
  }

  // Check no active session for this drone
  const activeSession = await FlightSession.findOne({
    drone: drone._id,
    status: { $in: ["STARTING", "IN_PROGRESS"] },
  });
  if (activeSession) {
    throw new Error("Drone already has an active flight session");
  }

  // Create session
  const session = await FlightSession.create({
    flightPlan: plan._id,
    drone: drone._id,
    pilot: userId,
    sessionType: "PLANNED",
    status: "IN_PROGRESS",
    actualStart: new Date(),
  });

  // Set drone status to FLYING
  drone.status = "FLYING";
  await drone.save();

  return session;
}

/**
 * Start free flight session — INDIVIDUAL_OPERATOR only, no FlightPlan
 */
async function startFreeFlightSession(droneId, userId, userRole) {
  if (userRole !== "INDIVIDUAL_OPERATOR") {
    throw new Error("Only INDIVIDUAL_OPERATOR can start free flight sessions");
  }

  const drone = await Drone.findById(droneId);
  if (!drone) throw new Error("Drone not found");

  if (drone.owner.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this drone");
  }

  if (drone.status !== "IDLE") {
    throw new Error(
      `Drone is currently "${drone.status}". Only IDLE drones can start a session.`,
    );
  }

  // Check no active session
  const activeSession = await FlightSession.findOne({
    drone: drone._id,
    status: { $in: ["STARTING", "IN_PROGRESS"] },
  });
  if (activeSession) {
    throw new Error("Drone already has an active flight session");
  }

  const session = await FlightSession.create({
    drone: drone._id,
    pilot: userId,
    sessionType: "FREE_FLIGHT",
    status: "IN_PROGRESS",
    actualStart: new Date(),
  });

  drone.status = "FLYING";
  await drone.save();

  return session;
}

/**
 * End session → COMPLETED, build actualRoute from telemetry
 */
async function endSession(sessionId, userId) {
  const session = await FlightSession.findById(sessionId);
  if (!session) throw new Error("Flight session not found");

  if (session.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this session");
  }

  if (!["STARTING", "IN_PROGRESS"].includes(session.status)) {
    throw new Error(`Cannot end session with status "${session.status}"`);
  }

  session.status = "COMPLETED";
  session.actualEnd = new Date();

  // Build actualRoute from telemetry data
  await buildActualRoute(session);

  await session.save();

  // Set drone back to IDLE
  await Drone.findByIdAndUpdate(session.drone, { status: "IDLE" });

  return session;
}

/**
 * Abort session
 */
async function abortSession(sessionId, userId) {
  const session = await FlightSession.findById(sessionId);
  if (!session) throw new Error("Flight session not found");

  if (session.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this session");
  }

  if (!["STARTING", "IN_PROGRESS"].includes(session.status)) {
    throw new Error(`Cannot abort session with status "${session.status}"`);
  }

  session.status = "ABORTED";
  session.actualEnd = new Date();
  await buildActualRoute(session);
  await session.save();

  await Drone.findByIdAndUpdate(session.drone, { status: "IDLE" });

  return session;
}

/**
 * Emergency land
 */
async function emergencyLand(sessionId, userId) {
  const session = await FlightSession.findById(sessionId);
  if (!session) throw new Error("Flight session not found");

  if (session.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this session");
  }

  if (!["STARTING", "IN_PROGRESS"].includes(session.status)) {
    throw new Error(
      `Cannot emergency land session with status "${session.status}"`,
    );
  }

  session.status = "EMERGENCY_LANDED";
  session.actualEnd = new Date();
  await buildActualRoute(session);
  await session.save();

  await Drone.findByIdAndUpdate(session.drone, { status: "IDLE" });

  return session;
}

/**
 * Build actualRoute (GeoJSON LineString) from telemetry data
 */
async function buildActualRoute(session) {
  const telemetryData = await Telemetry.find({
    flightSession: session._id,
  }).sort({ timestamp: 1 });

  if (telemetryData.length >= 2) {
    session.actualRoute = {
      type: "LineString",
      coordinates: telemetryData.map((t) => t.location.coordinates),
    };
  }
}

module.exports = {
  startPlannedSession,
  startFreeFlightSession,
  endSession,
  abortSession,
  emergencyLand,
};
