const Zone = require("../../../models/zone.model");
const ConflictEvent = require("./conflictEvent.model");

/**
 * Kiểm tra flight plan có đi qua zone cấm hay không
 * Sử dụng $geoIntersects giữa routeGeometry (LineString) và Zone geometry (Polygon)
 *
 * @param {Object} flightPlan - Flight plan document (phải có routeGeometry và waypoints)
 * @returns {Array} Danh sách zone violations
 */
async function checkFlightPlanZoneViolations(flightPlan) {
  if (
    !flightPlan.routeGeometry ||
    !flightPlan.routeGeometry.coordinates ||
    flightPlan.routeGeometry.coordinates.length < 2
  ) {
    return [];
  }

  // 1. Tìm zones active mà route geometry đi qua (spatial intersection)
  const intersectingZones = await Zone.find({
    status: "active",
    geometry: {
      $geoIntersects: {
        $geometry: flightPlan.routeGeometry,
      },
    },
  });

  if (intersectingZones.length === 0) return [];

  // 2. Lọc thêm theo altitude và thời gian
  const violations = [];

  for (const zone of intersectingZones) {
    // Check altitude overlap
    const planMinAlt = Math.min(
      ...flightPlan.waypoints.map((wp) => wp.altitude),
    );
    const planMaxAlt = Math.max(
      ...flightPlan.waypoints.map((wp) => wp.altitude),
    );

    const altitudeOverlap =
      planMaxAlt >= zone.minAltitude && planMinAlt <= zone.maxAltitude;

    if (!altitudeOverlap) continue;

    // Check time overlap (zone effective period vs flight plan time)
    const now = new Date();
    const zoneStart = zone.effectiveFrom || new Date(0);
    const zoneEnd = zone.effectiveTo || new Date("2099-12-31");
    const planStart = new Date(flightPlan.plannedStart);
    const planEnd = new Date(flightPlan.plannedEnd);

    const timeOverlap = planStart <= zoneEnd && planEnd >= zoneStart;

    if (!timeOverlap) continue;

    // Zone violation confirmed
    violations.push({
      flightPlans: [flightPlan._id],
      detectedAt: new Date(),
      severity: zone.type === "no_fly" ? "CRITICAL" : "HIGH",
      location: {
        type: "Point",
        coordinates: zone.geometry.coordinates[0][0], // Dùng điểm đầu của zone
      },
      altitude: (planMinAlt + planMaxAlt) / 2,
      detectionMethod: "ZONE_VIOLATION",
      status: "ACTIVE",
      violatedZone: zone._id,
    });
  }

  return violations;
}

/**
 * Lưu zone violations vào database dưới dạng ConflictEvents
 */
async function saveZoneViolations(violations) {
  const savedEvents = [];
  for (const violation of violations) {
    const event = await ConflictEvent.create(violation);
    savedEvents.push(event);
  }
  return savedEvents;
}

module.exports = {
  checkFlightPlanZoneViolations,
  saveZoneViolations,
};
