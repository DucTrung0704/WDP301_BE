/**
 * Nearby Drones Query Service
 *
 * Returns a merged list of real drones (from Redis telemetry cache) and
 * mock drones (from Redis mock cache) within a given radius.
 */

const { cacheOps } = require("../../config/redis");

const EARTH_RADIUS = 6371000; // metres

/** Haversine distance in metres (local copy to avoid circular deps) */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get all drones (real + mock) within radiusM of a point.
 *
 * @param {number} lat              - Centre latitude
 * @param {number} lng              - Centre longitude
 * @param {number} radiusM          - Search radius in metres (default 1000)
 * @param {string[]} excludeDroneIds - Drone IDs to exclude (e.g. the querying drone itself)
 * @returns {Promise<Array<{droneId, lat, lng, altitude, heading, speed, isMock}>>}
 */
async function getNearbyDrones(lat, lng, radiusM = 1000, excludeDroneIds = []) {
  const excludeSet = new Set(excludeDroneIds.map(String));

  const [realLocations, mockLocations] = await Promise.all([
    cacheOps.getAllDroneLocations(),
    cacheOps.getAllMockDroneLocations(),
  ]);

  const nearby = [];

  for (const loc of realLocations) {
    if (excludeSet.has(String(loc.droneId))) continue;
    const dist = haversineDistance(lat, lng, loc.lat, loc.lng);
    if (dist <= radiusM) {
      nearby.push({
        droneId:  loc.droneId,
        lat:      loc.lat,
        lng:      loc.lng,
        altitude: loc.alt ?? 0,
        heading:  loc.heading ?? 0,
        speed:    loc.speed ?? 0,
        isMock:   false,
      });
    }
  }

  for (const loc of mockLocations) {
    if (excludeSet.has(String(loc.droneId))) continue;
    const dist = haversineDistance(lat, lng, loc.lat, loc.lng);
    if (dist <= radiusM) {
      nearby.push({
        droneId:  loc.droneId,
        lat:      loc.lat,
        lng:      loc.lng,
        altitude: loc.alt ?? 0,
        heading:  loc.heading ?? 0,
        speed:    loc.speed ?? 0,
        isMock:   true,
      });
    }
  }

  return nearby;
}

module.exports = { getNearbyDrones };
