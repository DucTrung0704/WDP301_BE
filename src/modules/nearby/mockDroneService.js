/**
 * Mock Drone Simulation Service
 *
 * Simulates N globally-shared drones moving in patrol routes (A→B→A).
 * Positions are persisted to Redis every tick so all subscribers see the same state.
 *
 * Config via ENV:
 *   NEARBY_MOCK_COUNT      - number of mock drones (default 5)
 *   MOCK_DRONE_BASE_LAT    - spawn center latitude  (default 10.762622 — HCMC)
 *   MOCK_DRONE_BASE_LNG    - spawn center longitude (default 106.660172)
 *   MOCK_DRONE_SPREAD_M    - spawn radius in meters (default 2000)
 *   NEARBY_PUSH_INTERVAL_MS - simulation tick in ms (default 1000)
 */

const { cacheOps } = require("../../config/redis");

// ── Config ──────────────────────────────────────────────────────────────────
const MOCK_COUNT      = parseInt(process.env.NEARBY_MOCK_COUNT)      || 5;
const BASE_LAT        = parseFloat(process.env.MOCK_DRONE_BASE_LAT)  || 10.717222;
const BASE_LNG        = parseFloat(process.env.MOCK_DRONE_BASE_LNG)  || 106.643371;
const SPREAD_M        = parseFloat(process.env.MOCK_DRONE_SPREAD_M)  || 2000;
const TICK_MS         = parseInt(process.env.NEARBY_PUSH_INTERVAL_MS) || 1000;
const MOCK_SPEED_MS   = 5;    // m/s — typical drone cruise speed
const EARTH_RADIUS    = 6371000; // metres

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Convert degrees to radians */
const toRad = (deg) => (deg * Math.PI) / 180;

/** Convert radians to degrees */
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Haversine distance in metres */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Bearing from point A → point B in degrees (0–360) */
function bearingTo(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Advance a position by `distanceM` metres along `bearing` degrees */
function advancePosition(lat, lng, bearing, distanceM) {
  const δ = distanceM / EARTH_RADIUS;
  const θ = toRad(bearing);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );

  return { lat: toDeg(φ2), lng: toDeg(λ2) };
}

/** Random point within `radiusM` metres of (baseLat, baseLng) */
function randomNearby(baseLat, baseLng, radiusM) {
  const bearing = Math.random() * 360;
  const distance = Math.random() * radiusM;
  return advancePosition(baseLat, baseLng, bearing, distance);
}

// ── Mock drone state ──────────────────────────────────────────────────────────

/** @type {Array<{id, lat, lng, alt, speed, heading, waypoints: [{lat,lng}], waypointIndex, direction}>} */
let mockDrones = [];
let simulationInterval = null;

/**
 * Create N mock drones with patrol routes
 */
function initMockDrones() {
  mockDrones = [];

  for (let i = 0; i < MOCK_COUNT; i++) {
    // Patrol: random point A and B within SPREAD_M
    const pointA = randomNearby(BASE_LAT, BASE_LNG, SPREAD_M);
    const pointB = randomNearby(BASE_LAT, BASE_LNG, SPREAD_M);
    const alt = 50 + Math.random() * 150; // 50–200 m AGL

    mockDrones.push({
      id: `MOCK-DRONE-${String(i + 1).padStart(3, "0")}`,
      lat: pointA.lat,
      lng: pointA.lng,
      alt: Math.round(alt),
      speed: MOCK_SPEED_MS,
      heading: bearingTo(pointA.lat, pointA.lng, pointB.lat, pointB.lng),
      waypoints: [pointA, pointB],
      waypointIndex: 1, // currently heading towards waypoints[1]
      direction: 1,     // +1 forward, -1 reverse
    });
  }

  console.log(`✅ Mock drones initialized (${MOCK_COUNT} drones)`);
}

/**
 * Advance each mock drone one tick along its patrol route
 */
async function tick() {
  const promises = [];

  for (const drone of mockDrones) {
    const target = drone.waypoints[drone.waypointIndex];
    const dist = haversineDistance(drone.lat, drone.lng, target.lat, target.lng);
    const step = MOCK_SPEED_MS * (TICK_MS / 1000); // metres this tick

    if (dist <= step + 5) {
      // Reached (or nearly reached) waypoint — reverse direction
      drone.direction *= -1;
      drone.waypointIndex = drone.direction === 1 ? 1 : 0;
      const nextTarget = drone.waypoints[drone.waypointIndex];
      drone.heading = bearingTo(drone.lat, drone.lng, nextTarget.lat, nextTarget.lng);
    } else {
      // Advance toward target
      const next = advancePosition(drone.lat, drone.lng, drone.heading, step);
      drone.lat = next.lat;
      drone.lng = next.lng;
      // Slight heading recalculation to correct drift
      drone.heading = bearingTo(drone.lat, drone.lng, target.lat, target.lng);
    }

    // Gentle altitude oscillation ±5 m
    drone.alt = drone.alt + (Math.random() - 0.5) * 2;
    drone.alt = Math.max(30, Math.min(250, drone.alt));

    promises.push(
      cacheOps.setMockDroneLocation(drone.id, {
        lat: drone.lat,
        lng: drone.lng,
        alt: Math.round(drone.alt),
        speed: drone.speed,
        heading: Math.round(drone.heading),
      }),
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Start the global simulation loop
 */
function startMockDroneSimulation() {
  if (simulationInterval) return; // already running

  initMockDrones();

  simulationInterval = setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      console.error("Mock drone simulation tick error:", err.message);
    }
  }, TICK_MS);

  console.log(`✅ Mock drone simulation started (tick: ${TICK_MS}ms)`);
}

/**
 * Stop the simulation (called on graceful shutdown)
 */
function stopMockDroneSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("✅ Mock drone simulation stopped");
  }
}

module.exports = {
  startMockDroneSimulation,
  stopMockDroneSimulation,
};
