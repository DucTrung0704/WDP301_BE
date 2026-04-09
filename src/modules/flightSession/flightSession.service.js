const FlightSession = require("./flightSession.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const MissionPlan = require("../mission/missionPlan.model");
const Drone = require("../../../models/drone.model");
const Telemetry = require("../telemetry/telemetry.model");

/**
 * Start planned session — requires ACTIVE FlightPlan and optional MissionPlanId
 * Both INDIVIDUAL_OPERATOR and FLEET_OPERATOR can use this
 */
async function startPlannedSession(flightPlanId, userId, missionPlanId = null) {
  const plan = await FlightPlan.findById(flightPlanId);
  if (!plan) throw new Error("Flight plan not found");

  if (plan.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this flight plan");
  }

  if (plan.status !== "ACTIVE") {
    throw new Error(
      `Cannot start session: flight plan status is "${plan.status}". Only ACTIVE plans can start sessions.`,
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

  // If missionPlanId provided, validate and prepare to update its status
  let missionPlan = null;
  if (missionPlanId) {
    missionPlan = await MissionPlan.findById(missionPlanId);
    if (!missionPlan) throw new Error("Mission plan not found");
    if (missionPlan.status !== "SCHEDULED") {
      throw new Error(`Mission plan is already ${missionPlan.status}`);
    }
    if (missionPlan.flightPlan.toString() !== plan._id.toString()) {
      throw new Error("Mission plan does not reference this flight plan");
    }
  }

  // Create session
  const session = await FlightSession.create({
    flightPlan: plan._id,
    missionPlan: missionPlanId,
    drone: drone._id,
    pilot: userId,
    sessionType: "PLANNED",
    status: "IN_PROGRESS",
    actualStart: new Date(),
  });

  // Update MissionPlan status if it was provided
  if (missionPlan) {
    missionPlan.status = "IN_PROGRESS";
    await missionPlan.save();
  }

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

  // Update MissionPlan status if linked
  if (session.missionPlan) {
    await MissionPlan.findByIdAndUpdate(session.missionPlan, { status: "COMPLETED" });
  }

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

  // Update MissionPlan status to COMPLETED if linked
  if (session.missionPlan) {
    await MissionPlan.findByIdAndUpdate(session.missionPlan, { status: "COMPLETED" });
  }

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

  // Update MissionPlan status to COMPLETED if linked
  if (session.missionPlan) {
    await MissionPlan.findByIdAndUpdate(session.missionPlan, { status: "COMPLETED" });
  }

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

  console.log(`\n🚁 [END FLIGHT] Đang gom tọa độ cho Session: ${session._id}`);
  console.log(`🚁 [END FLIGHT] Tìm thấy: ${telemetryData.length} điểm trong Database!`);

  if (telemetryData.length >= 2) {
    session.actualRoute = {
      type: "LineString",
      coordinates: telemetryData.map((t) => t.location.coordinates),
    };
    console.log(`✅ Đã vẽ xong đường bay với ${telemetryData.length} điểm!`);
  } else if (telemetryData.length === 1) {
    // Mongoose bắt buộc LineString phải có ít nhất 2 điểm. 
    // Nếu chỉ có 1 điểm, ta nhân đôi nó lên để lách luật, tránh bị lỗi mảng rỗng.
    const coord = telemetryData[0].location.coordinates;
    session.actualRoute = {
      type: "LineString",
      coordinates: [coord, coord],
    };
    console.log(`⚠️ Chỉ có 1 điểm tọa độ. Đã nhân đôi để tạo đường thẳng hợp lệ!`);
  } else {
    // Nếu là 0, ghi nhận rỗng.
    session.actualRoute = {
      type: "LineString",
      coordinates: [],
    };
    console.log(`❌ KHÔNG CÓ TỌA ĐỘ NÀO ĐƯỢC LƯU! (Lý do: Lái chưa đủ lâu hoặc chưa đợi Worker xả data trước khi ấn End)`);
  }
}

module.exports = {
  startPlannedSession,
  startFreeFlightSession,
  endSession,
  abortSession,
  emergencyLand,
};