const ConflictEvent = require("./conflictEvent.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const config = require("../../config/conflictConfig");

/**
 * Khoảng cách Haversine giữa 2 điểm (m)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Nội suy vị trí tại thời điểm t dựa trên danh sách waypoints
 * Trả về { latitude, longitude, altitude } hoặc null nếu ngoài phạm vi
 */
function interpolatePosition(waypoints, t) {
  const time = t instanceof Date ? t.getTime() : t;

  // Sort by estimatedTime
  const sorted = [...waypoints].sort(
    (a, b) =>
      new Date(a.estimatedTime).getTime() - new Date(b.estimatedTime).getTime(),
  );

  const firstTime = new Date(sorted[0].estimatedTime).getTime();
  const lastTime = new Date(sorted[sorted.length - 1].estimatedTime).getTime();

  // Ngoài phạm vi thời gian
  if (time < firstTime || time > lastTime) return null;

  // Tìm đoạn chứa thời điểm t
  for (let i = 0; i < sorted.length - 1; i++) {
    const t1 = new Date(sorted[i].estimatedTime).getTime();
    const t2 = new Date(sorted[i + 1].estimatedTime).getTime();

    if (time >= t1 && time <= t2) {
      // Tỉ lệ nội suy tuyến tính
      const ratio = t2 === t1 ? 0 : (time - t1) / (t2 - t1);

      return {
        latitude:
          sorted[i].latitude +
          ratio * (sorted[i + 1].latitude - sorted[i].latitude),
        longitude:
          sorted[i].longitude +
          ratio * (sorted[i + 1].longitude - sorted[i].longitude),
        altitude:
          sorted[i].altitude +
          ratio * (sorted[i + 1].altitude - sorted[i].altitude),
      };
    }
  }

  return null;
}

/**
 * Tìm khoảng thời gian chồng lấn giữa 2 flight plans
 * Trả về { start, end } (ms) hoặc null
 */
function getOverlappingTimeWindow(plan1, plan2) {
  const start1 = new Date(plan1.plannedStart).getTime();
  const end1 = new Date(plan1.plannedEnd).getTime();
  const start2 = new Date(plan2.plannedStart).getTime();
  const end2 = new Date(plan2.plannedEnd).getTime();

  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);

  if (overlapStart >= overlapEnd) return null;

  return { start: overlapStart, end: overlapEnd };
}

/**
 * Ánh xạ tọa độ thành cell ID cho Segmentation
 */
function pointToCell(lat, lng, alt, gridConfig) {
  const { CELL_SIZE_X, CELL_SIZE_Y, CELL_SIZE_Z } = gridConfig;

  // Chuyển lat/lng thành meters (xấp xỉ)
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos((lat * Math.PI) / 180);

  const cellX = Math.floor((lng * metersPerDegreeLng) / CELL_SIZE_X);
  const cellY = Math.floor((lat * metersPerDegreeLat) / CELL_SIZE_Y);
  const cellZ = Math.floor(alt / CELL_SIZE_Z);

  return `${cellX}_${cellY}_${cellZ}`;
}

/**
 * Xác định mức độ nghiêm trọng dựa trên khoảng cách
 */
function determineSeverity(horizontalDist, verticalDist) {
  const minDist = Math.min(horizontalDist, verticalDist * 3); // Weight vertical more
  const { CRITICAL_DISTANCE, HIGH_DISTANCE, MEDIUM_DISTANCE } = config.severity;

  if (minDist < CRITICAL_DISTANCE) return "CRITICAL";
  if (minDist < HIGH_DISTANCE) return "HIGH";
  if (minDist < MEDIUM_DISTANCE) return "MEDIUM";
  return "LOW";
}

// ============================================================
// THUẬT TOÁN 1: Pairwise 4D Trajectory Conflict Detection
// ============================================================

/**
 * So sánh quỹ đạo 4D của flight plan mới với các plans đã approved
 * @param {Object} newPlan - Flight plan mới
 * @param {Array} existingPlans - Danh sách plans đã approved
 * @returns {Array} Danh sách conflicts phát hiện được
 */
function pairwiseConflictCheck(newPlan, existingPlans) {
  const { D_MIN, H_MIN, TIME_STEP } = config.pairwise;
  const conflicts = [];

  for (const existingPlan of existingPlans) {
    const overlap = getOverlappingTimeWindow(newPlan, existingPlan);
    if (!overlap) continue; // Không chồng lấn thời gian → skip

    // Duyệt qua từng bước thời gian trong khoảng chồng lấn
    const timeStepMs = TIME_STEP * 1000;
    for (let t = overlap.start; t <= overlap.end; t += timeStepMs) {
      const pos1 = interpolatePosition(newPlan.waypoints, t);
      const pos2 = interpolatePosition(existingPlan.waypoints, t);

      if (!pos1 || !pos2) continue;

      // Tính khoảng cách
      const dXY = haversineDistance(
        pos1.latitude,
        pos1.longitude,
        pos2.latitude,
        pos2.longitude,
      );
      const dZ = Math.abs(pos1.altitude - pos2.altitude);

      // Kiểm tra vi phạm khoảng cách an toàn
      if (dXY < D_MIN && dZ < H_MIN) {
        conflicts.push({
          flightPlans: [newPlan._id, existingPlan._id],
          predictedCollisionTime: new Date(t),
          severity: determineSeverity(dXY, dZ),
          location: {
            type: "Point",
            coordinates: [
              (pos1.longitude + pos2.longitude) / 2,
              (pos1.latitude + pos2.latitude) / 2,
            ],
          },
          altitude: (pos1.altitude + pos2.altitude) / 2,
          detectionMethod: "PAIRWISE",
          horizontalDistance: Math.round(dXY * 100) / 100,
          verticalDistance: Math.round(dZ * 100) / 100,
        });

        // Chỉ ghi nhận conflict đầu tiên cho mỗi cặp plan
        // (tránh trùng lặp quá nhiều)
        break;
      }
    }
  }

  return conflicts;
}

// ============================================================
// THUẬT TOÁN 2: Airspace Segmentation-based Conflict Detection
// ============================================================

/**
 * Chia grid + time slot, kiểm tra occupancy map
 * @param {Object} newPlan - Flight plan mới
 * @param {Array} existingPlans - Danh sách plans đã approved
 * @returns {Array} Danh sách conflicts phát hiện được
 */
function segmentationConflictCheck(newPlan, existingPlans) {
  const { CELL_SIZE_X, CELL_SIZE_Y, CELL_SIZE_Z, TIME_SLOT } =
    config.segmentation;
  const gridConfig = { CELL_SIZE_X, CELL_SIZE_Y, CELL_SIZE_Z };
  const timeSlotMs = TIME_SLOT * 1000;

  // Occupancy Map: key = "cellId_timeSlot" → [{ planId, position }]
  const occupancyMap = new Map();
  const allPlans = [newPlan, ...existingPlans];

  // Tìm time range tổng
  let globalStart = Infinity;
  let globalEnd = -Infinity;
  for (const plan of allPlans) {
    const s = new Date(plan.plannedStart).getTime();
    const e = new Date(plan.plannedEnd).getTime();
    if (s < globalStart) globalStart = s;
    if (e > globalEnd) globalEnd = e;
  }

  // Populate occupancy map
  for (const plan of allPlans) {
    for (let t = globalStart; t <= globalEnd; t += timeSlotMs) {
      const pos = interpolatePosition(plan.waypoints, t);
      if (!pos) continue;

      const cellId = pointToCell(
        pos.latitude,
        pos.longitude,
        pos.altitude,
        gridConfig,
      );
      const timeSlotIndex = Math.floor((t - globalStart) / timeSlotMs);
      const key = `${cellId}_${timeSlotIndex}`;

      if (!occupancyMap.has(key)) {
        occupancyMap.set(key, []);
      }

      occupancyMap.get(key).push({
        planId: plan._id,
        position: pos,
        time: t,
      });
    }
  }

  // Detect conflicts: cell+timeSlot có ≥2 plans khác nhau, trong đó có newPlan
  const conflicts = [];
  const processedPairs = new Set(); // Tránh trùng lặp cặp

  for (const [, occupants] of occupancyMap) {
    if (occupants.length < 2) continue;

    // Chỉ quan tâm nếu newPlan nằm trong cell này
    const newPlanOccupants = occupants.filter(
      (o) => o.planId.toString() === newPlan._id.toString(),
    );
    if (newPlanOccupants.length === 0) continue;

    // Tìm các plan khác trong cùng cell
    const otherOccupants = occupants.filter(
      (o) => o.planId.toString() !== newPlan._id.toString(),
    );

    for (const other of otherOccupants) {
      const pairKey = `${newPlan._id}_${other.planId}`;
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const newPos = newPlanOccupants[0].position;
      const dXY = haversineDistance(
        newPos.latitude,
        newPos.longitude,
        other.position.latitude,
        other.position.longitude,
      );
      const dZ = Math.abs(newPos.altitude - other.position.altitude);

      conflicts.push({
        flightPlans: [newPlan._id, other.planId],
        predictedCollisionTime: new Date(other.time),
        severity: determineSeverity(dXY, dZ),
        location: {
          type: "Point",
          coordinates: [
            (newPos.longitude + other.position.longitude) / 2,
            (newPos.latitude + other.position.latitude) / 2,
          ],
        },
        altitude: (newPos.altitude + other.position.altitude) / 2,
        detectionMethod: "SEGMENTATION",
        horizontalDistance: Math.round(dXY * 100) / 100,
        verticalDistance: Math.round(dZ * 100) / 100,
      });
    }
  }

  return conflicts;
}

// ============================================================
// ORCHESTRATOR
// ============================================================

/**
 * Dismiss các ConflictEvents cũ của flight plan (khi resubmit)
 */
async function dismissOldConflicts(flightPlanId) {
  await ConflictEvent.updateMany(
    { flightPlans: flightPlanId, status: "ACTIVE" },
    { status: "DISMISSED" },
  );
}

/**
 * Export functions
 */
module.exports = {
  // Algorithms
  pairwiseConflictCheck,
  segmentationConflictCheck,
  // Utility
  dismissOldConflicts,
  // Helpers (exported for testing)
  haversineDistance,
  interpolatePosition,
  getOverlappingTimeWindow,
  pointToCell,
  determineSeverity,
};
