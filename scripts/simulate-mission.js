#!/usr/bin/env node
/**
 * simulate-mission.js
 * Mission Orchestrated Fleet Drone Simulator
 *
 * Simulates all drones in a mission concurrently.
 * Includes a pre-flight 4D safety check before any session is started.
 *
 * Usage:
 *   node scripts/simulate-mission.js \
 *     --missionId=<objectId> \
 *     --token=<jwt> \
 *     [--mode=normal|deviation|battery-drop] \
 *     [--timeScale=10]           (10× speed, default 1)
 *     [--tickMs=1000]            (telemetry interval ms, default 1000)
 *     [--deviationDroneIndex=0]  (which drone gets deviation mode)
 *     [--skipSafetyCheck=1]      (skip pre-flight check — NOT recommended)
 *
 * Environment variables (override CLI):
 *   BASE_URL          — HTTP base URL (default http://localhost:3000)
 *   WS_URL            — WebSocket URL (default = BASE_URL)
 *   SIMULATOR_TOKEN   — JWT token
 *
 * Notes:
 *   - Requires Node 18+ (uses global fetch).
 *   - socket.io-client must be installed (listed in devDependencies).
 *   - Run telemetryRedisWorker.js separately for telemetry persistence to MongoDB.
 *   - For deviation alerts to fire in the backend, flight plan waypoints need
 *     estimatedTime values aligned with the mission plannedStart/plannedEnd window.
 */

'use strict';

require('dotenv').config();

const { FlightPlanFollower, haversineDistance, D_MIN, H_MIN } = require('./flight-plan-follower');

// ── CLI helpers ───────────────────────────────────────────────────────────────

function getArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : undefined;
}

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || BASE_URL;
const TOKEN = getArg('token') || process.env.SIMULATOR_TOKEN;
const MISSION_ID = getArg('missionId');
const MODE = getArg('mode') || 'normal';
const TIME_SCALE = parseFloat(getArg('timeScale') ?? '1');
const TICK_MS = parseInt(getArg('tickMs') ?? '1000', 10);
const DEV_INDEX = parseInt(getArg('deviationDroneIndex') ?? '0', 10);
const SKIP_CHECK = Boolean(getArg('skipSafetyCheck'));

// Pairwise check resolution — matches TIME_STEP in conflictConfig.js
const CHECK_STEP_MS = 30_000; // 30 seconds

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function apiRequest(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({ message: res.statusText }));

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${data.message || data.error || JSON.stringify(data)}`);
  }
  return data;
}

const apiGet = (path) => apiRequest('GET', path);
const apiPost = (path, body) => apiRequest('POST', path, body);

// ── Pre-flight safety check ───────────────────────────────────────────────────

/**
 * Pairwise 4D trajectory conflict detection.
 *
 * For every pair of followers that share overlapping time windows,
 * steps through the overlap at CHECK_STEP_MS resolution and checks:
 *
 *   độ cao      (H_MIN = 30 m)  — vertical separation
 *   quãng đường (D_MIN = 100 m) — horizontal haversine distance
 *   vận tốc                     — relative speed vector for TTC
 *   thời gian                   — time-to-conflict = dXY / relSpeed
 *
 * A conflict is flagged when BOTH dXY < D_MIN AND dZ < H_MIN simultaneously.
 *
 * @param {FlightPlanFollower[]} followers
 * @returns {Array<CheckResult>}
 */
function preMissionSafetyCheck(followers) {
  const results = [];

  for (let i = 0; i < followers.length; i++) {
    for (let j = i + 1; j < followers.length; j++) {
      const fA = followers[i];
      const fB = followers[j];

      const idA = `...${fA.droneId.slice(-6)}`;
      const idB = `...${fB.droneId.slice(-6)}`;

      // ── 1. Thời gian: check time window overlap ─────────────────────────
      const overlapStart = Math.max(fA.plannedStart.getTime(), fB.plannedStart.getTime());
      const overlapEnd = Math.min(fA.plannedEnd.getTime(), fB.plannedEnd.getTime());

      if (overlapStart >= overlapEnd) {
        results.push({ pair: [idA, idB], hasConflict: false, noTimeOverlap: true });
        continue;
      }

      let closestDXY = Infinity;
      let closestDZ = Infinity;
      let conflictTimeMs = null;
      let minTtcSec = Infinity;

      // ── 2. Stepwise trajectory comparison ──────────────────────────────
      for (let t = overlapStart; t <= overlapEnd; t += CHECK_STEP_MS) {
        const posA = fA.interpolateAt(t);
        const posB = fB.interpolateAt(t);

        // Quãng đường: horizontal separation
        const dXY = haversineDistance(posA.latitude, posA.longitude, posB.latitude, posB.longitude);

        // Độ cao: vertical separation
        const dZ = Math.abs(posA.altitude - posB.altitude);

        if (dXY < closestDXY) { closestDXY = dXY; closestDZ = dZ; }

        // Vận tốc tương đối: velocity difference vector
        const toRad = (d) => (d * Math.PI) / 180;
        const vxA = (posA.speed ?? 10) * Math.sin(toRad(posA.heading ?? 0));
        const vyA = (posA.speed ?? 10) * Math.cos(toRad(posA.heading ?? 0));
        const vxB = (posB.speed ?? 10) * Math.sin(toRad(posB.heading ?? 0));
        const vyB = (posB.speed ?? 10) * Math.cos(toRad(posB.heading ?? 0));
        const relSpeed = Math.sqrt((vxA - vxB) ** 2 + (vyA - vyB) ** 2);

        // Thời gian: estimated time-to-closest approach
        if (relSpeed > 0.5) {
          const ttcSec = dXY / relSpeed;
          if (ttcSec < minTtcSec) minTtcSec = ttcSec;
        }

        // Conflict threshold: horizontal AND vertical both breached
        if (dXY < D_MIN && dZ < H_MIN) {
          conflictTimeMs = t;
          break;
        }
      }

      results.push({
        pair: [idA, idB],
        hasConflict: conflictTimeMs !== null,
        closestDXY: Math.round(closestDXY),
        closestDZ: Math.round(closestDZ),
        conflictTimeMs,
        minTtcSec: isFinite(minTtcSec) ? Math.round(minTtcSec) : null,
      });
    }
  }

  return results;
}

// ── Mission loader ────────────────────────────────────────────────────────────

async function loadMission(missionId) {
  const data = await apiGet(`/api/missions/${missionId}`);
  // API returns { mission, missionPlans } or { data: { mission, missionPlans } }
  const mission = data.mission || data.data?.mission;
  const missionPlans = data.missionPlans || data.data?.missionPlans || [];
  if (!mission) throw new Error(`Unexpected mission response shape: ${JSON.stringify(Object.keys(data))}`);
  return { mission, missionPlans };
}

async function activateMissionIfNeeded(mission) {
  if (mission.status === 'DRAFT') {
    console.log('  ↪  Mission is DRAFT — calling startMission to activate...');
    await apiPost(`/api/missions/${mission._id}/start`, {});
    console.log('  ✅  Mission activated.');
  }
}

// ── Follower factory ──────────────────────────────────────────────────────────

/**
 * Builds one FlightPlanFollower per valid mission plan.
 * @param {Array}  missionPlans
 * @param {Map}    sharedPositions  - shared across all followers
 * @returns {FlightPlanFollower[]}
 */
function buildFollowers(missionPlans, sharedPositions) {
  const followers = [];

  for (let idx = 0; idx < missionPlans.length; idx++) {
    const mp = missionPlans[idx];

    if (!mp.flightPlan) {
      console.warn(`  ⏭  Plan[${idx}] id=${mp._id}: no flightPlan populated — skipped`);
      continue;
    }
    if (mp.status === 'CANCELLED') {
      console.warn(`  ⏭  Plan[${idx}] id=${mp._id}: CANCELLED — skipped`);
      continue;
    }

    const fp = mp.flightPlan;

    if (!fp.waypoints || fp.waypoints.length < 2) {
      console.warn(`  ⏭  Plan[${idx}] flightPlan=${fp._id}: fewer than 2 waypoints — skipped`);
      continue;
    }

    const sortedWaypoints = [...fp.waypoints].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    // Determine drone ObjectId: fp.drone is populated object or bare ObjectId
    const droneId = typeof fp.drone === 'object'
      ? (fp.drone._id ?? fp.drone).toString()
      : fp.drone.toString();

    // Apply mode overrides per index
    let followerMode = MODE;
    if (MODE !== 'deviation' && MODE !== 'battery-drop') followerMode = 'normal';
    if (MODE === 'deviation' && idx !== DEV_INDEX) followerMode = 'normal';
    if (MODE === 'battery-drop' && idx !== missionPlans.length - 1) followerMode = 'normal';

    followers.push(new FlightPlanFollower({
      droneId,
      flightPlanId: fp._id.toString(),
      waypoints: sortedWaypoints,
      plannedStart: mp.plannedStart,
      plannedEnd: mp.plannedEnd,
      tickMs: TICK_MS,
      timeScale: TIME_SCALE,
      mode: followerMode,
      deviationOffset: 200,
      deviationFrom: 0.3,
      deviationTo: 0.6,
      sharedPositions,
    }));
  }

  return followers;
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/**
 * Schedules each follower to start at the correct compressed-time offset.
 *
 * Real delay = (follower.plannedStart − minPlannedStart) / timeScale
 *
 * Example:
 *   Drone A: plannedStart = T+0,    real delay = 0s
 *   Drone B: plannedStart = T+30min, timeScale=10 → real delay = 180s
 *
 * @param {FlightPlanFollower[]} followers
 * @returns {Promise<PromiseSettledResult[]>}
 */
async function scheduleAndFly(followers) {
  const minStart = Math.min(...followers.map((f) => f.plannedStart.getTime()));

  const promises = followers.map((follower) => {
    const realDelayMs = (follower.plannedStart.getTime() - minStart) / TIME_SCALE;

    return new Promise((resolve) => setTimeout(resolve, realDelayMs))
      .then(() => {
        if (realDelayMs > 0) {
          console.log(`  🕐 [${follower.droneId.slice(-6)}] Delayed start after ${Math.round(realDelayMs / 1000)}s`);
        }
        return follower.fly(BASE_URL, WS_URL, TOKEN);
      });
  });

  return Promise.allSettled(promises);
}

// ── Console summary ───────────────────────────────────────────────────────────

function printSummary(followers, elapsedMs) {
  const wallSec = (elapsedMs / 1000).toFixed(1);
  const simMin = ((elapsedMs * TIME_SCALE) / 60_000).toFixed(1);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  📊  SIMULATION COMPLETE');
  console.log(`  Wall clock : ${wallSec}s  |  Simulated : ${simMin}min  |  Scale : ${TIME_SCALE}×`);
  console.log('──────────────────────────────────────────────────────');
  console.log('  DRONE         STATUS       TICKS  BATTERY  ALERTS');
  followers.forEach((f) => {
    const icon = f.status === 'COMPLETED' ? '✅' : '❌';
    const bat = `${f.batteryLevel.toFixed(0)}%`;
    console.log(
      `  ${icon} ...${f.droneId.slice(-6)}  ${f.status.padEnd(12)} ${String(f.tickCount).padStart(5)}  ${bat.padStart(7)}  ${f.alertsReceived.length}`,
    );
  });
  console.log('══════════════════════════════════════════════════════\n');
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateArgs() {
  const errors = [];
  if (!TOKEN) errors.push('Missing token — use --token=<jwt> or set SIMULATOR_TOKEN env var');
  if (!MISSION_ID) errors.push('Missing missionId — use --missionId=<objectId>');
  if (isNaN(TIME_SCALE) || TIME_SCALE <= 0) errors.push('timeScale must be a positive number');
  if (isNaN(TICK_MS) || TICK_MS < 100) errors.push('tickMs must be >= 100');
  const validModes = ['normal', 'deviation', 'battery-drop'];
  if (!validModes.includes(MODE)) errors.push(`mode must be one of: ${validModes.join(', ')}`);
  return errors;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Print usage if no args
  if (process.argv.length < 3) {
    console.log(
      'Usage: node scripts/simulate-mission.js ' +
      '--missionId=<id> --token=<jwt> [--mode=normal] [--timeScale=1] [--tickMs=1000]',
    );
    process.exit(0);
  }

  const errors = validateArgs();
  if (errors.length) {
    errors.forEach((e) => console.error(`❌  ${e}`));
    process.exit(1);
  }

  console.log('');
  console.log('🚁  MISSION FLEET SIMULATOR');
  console.log(`    mode=${MODE}  timeScale=${TIME_SCALE}×  tick=${TICK_MS}ms`);
  console.log(`    base=${BASE_URL}  ws=${WS_URL}`);
  console.log('');

  // ── Load mission ──────────────────────────────────────────────────────────
  console.log(`🔍  Loading mission ${MISSION_ID}...`);
  const { mission, missionPlans } = await loadMission(MISSION_ID);
  console.log(`✅  "${mission.name}"  status=${mission.status}  plans=${missionPlans.length}`);

  if (missionPlans.length === 0) {
    console.error('❌  No mission plans found. Add flight plans to the mission first.');
    process.exit(1);
  }

  // ── Activate mission if needed ────────────────────────────────────────────
  await activateMissionIfNeeded(mission);

  // ── Shared position state (inter-drone awareness) ─────────────────────────
  const sharedPositions = new Map();

  // ── Build followers ───────────────────────────────────────────────────────
  console.log('\n🔧  Building followers...');
  const followers = buildFollowers(missionPlans, sharedPositions);

  if (followers.length === 0) {
    console.error('❌  No valid followers could be built (check waypoints and plan status).');
    process.exit(1);
  }
  console.log(`    ${followers.length} follower(s) ready`);

  // ── Pre-flight safety check ───────────────────────────────────────────────
  if (!SKIP_CHECK && followers.length > 1) {
    console.log(`\n📋  Pre-flight Safety Check (${followers.length} drones — pairwise 4D)...`);

    const checkResults = preMissionSafetyCheck(followers);
    let hasBlocker = false;

    checkResults.forEach((r) => {
      const label = `${r.pair[0]} ↔ ${r.pair[1]}`;
      if (r.noTimeOverlap) {
        console.log(`  ✅  ${label}: no time overlap — clear`);
      } else if (r.hasConflict) {
        const offset = r.conflictTimeMs
          ? `T+${Math.round((r.conflictTimeMs - followers[0].plannedStart.getTime()) / 1000)}s`
          : '?';
        const ttc = r.minTtcSec != null ? `  TTC≈${r.minTtcSec}s` : '';
        console.log(`  🚨  ${label}: CONFLICT at ${offset} | dXY=${r.closestDXY}m dZ=${r.closestDZ}m${ttc}`);
        hasBlocker = true;
      } else {
        const ttc = r.minTtcSec != null ? `  minTTC=${r.minTtcSec}s` : '';
        console.log(`  ✅  ${label}: clear | closestDXY=${r.closestDXY}m dZ=${r.closestDZ}m${ttc}`);
      }
    });

    if (hasBlocker) {
      console.log('\n⛔  Pre-flight check FAILED — route conflicts detected.');
      console.log('    Fix the mission plans (adjust altitude, timing, or route) or use --skipSafetyCheck=1.\n');
      process.exit(1);
    }
    console.log('\n✅  Pre-flight check PASSED — all trajectories clear.\n');
  } else if (SKIP_CHECK) {
    console.log('\n⚠️   Pre-flight safety check SKIPPED.\n');
  }

  // ── Launch ────────────────────────────────────────────────────────────────
  console.log(`🚀  Launching ${followers.length} drone(s)...`);
  followers.forEach((f, i) => {
    const delay = (f.plannedStart.getTime() - followers[0].plannedStart.getTime()) / TIME_SCALE;
    console.log(`    [${i}] drone=...${f.droneId.slice(-6)}  mode=${f.mode}  start T+${Math.round(delay / 1000)}s (real)`);
  });
  console.log('');

  const t0 = Date.now();
  await scheduleAndFly(followers);
  const elapsed = Date.now() - t0;

  printSummary(followers, elapsed);
}

main().catch((err) => {
  console.error('\n❌  Fatal error:', err.message);
  if (process.env.VERBOSE) console.error(err.stack);
  process.exit(1);
});
