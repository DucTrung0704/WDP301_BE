const FlightPlan = require("./flightPlan.model");
const Drone = require("../../../models/drone.model");
const ConflictEvent = require("../conflict/conflictEvent.model");
const {
  checkFlightPlanConflicts,
  dismissOldConflicts,
} = require("../conflict/conflictDetection.service");
const {
  checkFlightPlanZoneViolations,
  saveZoneViolations,
} = require("../conflict/zoneConflict.service");

/**
 * Tạo Flight Plan mới (DRAFT)
 */
async function createFlightPlan(data, userId) {
  // Kiểm tra drone ownership
  const drone = await Drone.findById(data.drone);
  if (!drone) throw new Error("Drone not found");
  if (drone.owner.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this drone");
  }

  const flightPlan = new FlightPlan({
    ...data,
    pilot: userId,
    status: "DRAFT",
    conflictStatus: "CLEAR",
  });

  // Pre-save hook sẽ auto-generate routeGeometry
  await flightPlan.save();
  return flightPlan;
}

/**
 * Cập nhật Flight Plan (chỉ khi DRAFT hoặc REJECTED)
 * Nếu REJECTED → tự động reset về DRAFT + dismiss conflicts cũ
 */
async function updateFlightPlan(id, data, userId) {
  const flightPlan = await FlightPlan.findById(id);
  if (!flightPlan) throw new Error("Flight plan not found");

  // Chỉ pilot sở hữu mới được sửa
  if (flightPlan.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this flight plan");
  }

  // Chỉ cho sửa khi DRAFT hoặc REJECTED
  if (!["DRAFT", "REJECTED"].includes(flightPlan.status)) {
    throw new Error(
      `Cannot update flight plan with status "${flightPlan.status}". Only DRAFT or REJECTED plans can be edited.`,
    );
  }

  // Nếu đang REJECTED → reset về DRAFT + dismiss old conflicts
  if (flightPlan.status === "REJECTED") {
    flightPlan.status = "DRAFT";
    flightPlan.conflictStatus = "CLEAR";
    await dismissOldConflicts(id);
  }

  // Update fields
  const allowedFields = [
    "drone",
    "plannedStart",
    "plannedEnd",
    "priority",
    "waypoints",
    "notes",
  ];
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      flightPlan[field] = data[field];
    }
  }

  // Kiểm tra drone ownership nếu đổi drone
  if (data.drone && data.drone !== flightPlan.drone.toString()) {
    const drone = await Drone.findById(data.drone);
    if (!drone) throw new Error("Drone not found");
    if (drone.owner.toString() !== userId.toString()) {
      throw new Error("Unauthorized: You don't own this drone");
    }
  }

  await flightPlan.save(); // pre-save sẽ regenerate routeGeometry
  return flightPlan;
}

/**
 * Submit Flight Plan → chạy conflict detection → APPROVED/REJECTED
 */
async function submitFlightPlan(id, userId) {
  const flightPlan = await FlightPlan.findById(id);
  if (!flightPlan) throw new Error("Flight plan not found");

  if (flightPlan.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this flight plan");
  }

  if (flightPlan.status !== "DRAFT") {
    throw new Error(
      `Cannot submit flight plan with status "${flightPlan.status}". Only DRAFT plans can be submitted.`,
    );
  }

  // Validate waypoints
  if (!flightPlan.waypoints || flightPlan.waypoints.length < 2) {
    throw new Error("Flight plan must have at least 2 waypoints.");
  }

  // 1. Chạy conflict detection (Pairwise + Segmentation)
  const conflictResult = await checkFlightPlanConflicts(id);

  // 2. Chạy zone violation check
  // Reload plan vì checkFlightPlanConflicts có thể đã cập nhật
  const updatedPlan = await FlightPlan.findById(id);
  const zoneViolations = await checkFlightPlanZoneViolations(updatedPlan);

  if (zoneViolations.length > 0) {
    await saveZoneViolations(zoneViolations);

    // Nếu có zone violation → REJECTED
    updatedPlan.status = "REJECTED";
    updatedPlan.conflictStatus = "CONFLICT_DETECTED";
    await updatedPlan.save();
  }

  // Reload lần cuối để lấy trạng thái chính xác
  const finalPlan = await FlightPlan.findById(id)
    .populate("drone", "droneId serialNumber model")
    .populate("pilot", "email profile.fullName");

  // Lấy conflicts của plan này
  const conflicts = await ConflictEvent.find({
    flightPlans: id,
    status: "ACTIVE",
  });

  return {
    flightPlan: finalPlan,
    conflicts,
    approved: finalPlan.status === "APPROVED",
  };
}

/**
 * Cancel Flight Plan (từ DRAFT hoặc REJECTED)
 */
async function cancelFlightPlan(id, userId) {
  const flightPlan = await FlightPlan.findById(id);
  if (!flightPlan) throw new Error("Flight plan not found");

  if (flightPlan.pilot.toString() !== userId.toString()) {
    throw new Error("Unauthorized: You don't own this flight plan");
  }

  if (!["DRAFT", "REJECTED"].includes(flightPlan.status)) {
    throw new Error(
      `Cannot cancel flight plan with status "${flightPlan.status}". Only DRAFT or REJECTED plans can be cancelled.`,
    );
  }

  // Dismiss any active conflicts
  await dismissOldConflicts(id);

  flightPlan.status = "CANCELLED";
  await flightPlan.save();

  return flightPlan;
}

module.exports = {
  createFlightPlan,
  updateFlightPlan,
  submitFlightPlan,
  cancelFlightPlan,
};
