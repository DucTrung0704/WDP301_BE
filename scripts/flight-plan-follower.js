'use strict';
/**
 * FlightPlanFollower
 *
 * Simulates a single drone following a mission plan's route.
 * Uses linear interpolation across scheduled waypoints, mirroring
 * mapMissionPlanToScheduledTrajectory() in mission.service.js.
 *
 * Includes simulator-side anti-collision checks using four criteria:
 *   - độ cao      : vertical separation (dZ)
 *   - quãng đường : horizontal haversine distance (dXY)
 *   - vận tốc     : relative speed vector for TTC estimation
 *   - thời gian   : time-to-conflict (TTC = dXY / relSpeed)
 *
 * Requires Node 18+ (global fetch) and socket.io-client in devDependencies.
 */

const { io } = require('socket.io-client');

// ── Constants (must match src/config/conflictConfig.js) ──────────────────────
const EARTH_RADIUS = 6_371_000; // metres
const D_MIN = 100;              // horizontal separation threshold (m)
const H_MIN = 30;               // vertical separation threshold (m)

// ── Geometry helpers ──────────────────────────────────────────────────────────

function toRad(deg) { return (deg * Math.PI) / 180; }
function toDeg(rad) { return (rad * 180) / Math.PI; }

/**
 * Haversine great-circle distance in metres.
 * Used for quãng đường (horizontal separation).
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Bearing from point A → point B in degrees [0, 360).
 */
function bearingTo(lat1, lng1, lat2, lng2) {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function lerp(a, b, t) { return a + (b - a) * t; }

// ── FlightPlanFollower ────────────────────────────────────────────────────────

class FlightPlanFollower {
  /**
   * @param {object}  opts
   * @param {string}  opts.droneId            - Drone ObjectId string (Redis key / telemetry droneId)
   * @param {string}  opts.flightPlanId       - FlightPlan ObjectId string
   * @param {Array}   opts.waypoints          - Sorted waypoints [{sequenceNumber,latitude,longitude,altitude,speed}]
   * @param {Date}    opts.plannedStart       - Mission plan scheduled start
   * @param {Date}    opts.plannedEnd         - Mission plan scheduled end
   * @param {number}  [opts.tickMs=1000]      - Telemetry interval (real-world ms)
   * @param {number}  [opts.timeScale=1]      - Simulation speed multiplier (10 = 10× faster)
   * @param {string}  [opts.mode='normal']    - 'normal' | 'deviation' | 'battery-drop'
   * @param {number}  [opts.deviationOffset=200] - Lateral offset in metres (mode=deviation)
   * @param {number}  [opts.deviationFrom=0.3]   - Route fraction where deviation starts
   * @param {number}  [opts.deviationTo=0.6]     - Route fraction where deviation ends
   * @param {Map}     [opts.sharedPositions]  - Shared Map(droneId → {lat,lng,alt,speed,heading})
   */
  constructor(opts) {
    this.droneId = opts.droneId;
    this.flightPlanId = opts.flightPlanId;
    this.waypoints = opts.waypoints;
    this.plannedStart = new Date(opts.plannedStart);
    this.plannedEnd = new Date(opts.plannedEnd);
    this.tickMs = opts.tickMs ?? 1000;
    this.timeScale = opts.timeScale ?? 1;
    this.mode = opts.mode || 'normal';
    this.deviationOffset = opts.deviationOffset ?? 200;
    this.deviationFrom = opts.deviationFrom ?? 0.3;
    this.deviationTo = opts.deviationTo ?? 0.6;
    this.sharedPositions = opts.sharedPositions || new Map();

    // Public state (readable by orchestrator)
    this.sessionId = null;
    this.status = 'IDLE';   // IDLE | CONNECTING | STARTING | FLYING | LANDING | COMPLETED | FAILED
    this.batteryLevel = 100;
    this.tickCount = 0;
    this.alertsReceived = [];

    /** @private */
    this._socket = null;
    /** @private — waypoints with scheduledTime attached */
    this._scheduled = this._buildScheduledWaypoints();
  }

  // ── Waypoint scheduling ───────────────────────────────────────────────────

  /**
   * Distributes waypoints evenly across [plannedStart, plannedEnd].
   * Mirrors mapMissionPlanToScheduledTrajectory() in mission.service.js.
   * @private
   */
  _buildScheduledWaypoints() {
    const startMs = this.plannedStart.getTime();
    const endMs = this.plannedEnd.getTime();
    const durationMs = Math.max(1000, endMs - startMs);
    const n = this.waypoints.length;
    const segments = Math.max(1, n - 1);

    return this.waypoints.map((wp, i) => ({
      latitude: wp.latitude,
      longitude: wp.longitude,
      altitude: wp.altitude ?? 50,
      speed: wp.speed ?? 10,
      scheduledTime: startMs + (durationMs * i) / segments,
    }));
  }

  // ── Position interpolation ────────────────────────────────────────────────

  /**
   * Interpolate drone position at a given simulation timestamp (ms since epoch).
   *
   * Algorithms used:
   *   quãng đường  — haversine(wpA, wpB) for segment distance
   *   vận tốc      — speed = segDist / segTimeSec
   *   thời gian    — fraction = (t - t1) / (t2 - t1) for lerp
   *   độ cao       — lerp(altA, altB, fraction)
   *
   * PUBLIC — also called by preMissionSafetyCheck in simulate-mission.js.
   *
   * @param  {number} simTimeMs - Simulation epoch ms (startMs + elapsedSimMs)
   * @returns {{ latitude, longitude, altitude, speed, heading }}
   */
  interpolateAt(simTimeMs) {
    const wps = this._scheduled;

    if (simTimeMs <= wps[0].scheduledTime) {
      return { latitude: wps[0].latitude, longitude: wps[0].longitude, altitude: wps[0].altitude, speed: wps[0].speed, heading: 0 };
    }
    if (simTimeMs >= wps[wps.length - 1].scheduledTime) {
      return { latitude: wps[wps.length - 1].latitude, longitude: wps[wps.length - 1].longitude, altitude: wps[wps.length - 1].altitude, speed: 0, heading: 0 };
    }

    for (let i = 0; i < wps.length - 1; i++) {
      const t1 = wps[i].scheduledTime;
      const t2 = wps[i + 1].scheduledTime;
      if (simTimeMs < t1 || simTimeMs > t2) continue;

      // Thời gian: fractional position within segment
      const fraction = (simTimeMs - t1) / (t2 - t1);

      // Quãng đường + độ cao: lerp all spatial axes
      const latitude = lerp(wps[i].latitude, wps[i + 1].latitude, fraction);
      const longitude = lerp(wps[i].longitude, wps[i + 1].longitude, fraction);
      const altitude = lerp(wps[i].altitude, wps[i + 1].altitude, fraction);

      // Heading: direction of travel
      const heading = bearingTo(
        wps[i].latitude, wps[i].longitude,
        wps[i + 1].latitude, wps[i + 1].longitude,
      );

      // Vận tốc = quãng đường / thời gian (actual ground speed for this segment)
      const segDistM = haversineDistance(wps[i].latitude, wps[i].longitude, wps[i + 1].latitude, wps[i + 1].longitude);
      const segTimeSec = ((t2 - t1) / 1000) / this.timeScale;
      const speed = segTimeSec > 0.1 ? segDistM / segTimeSec : (wps[i].speed ?? 10);

      return {
        latitude: parseFloat(latitude.toFixed(7)),
        longitude: parseFloat(longitude.toFixed(7)),
        altitude: parseFloat(altitude.toFixed(2)),
        speed: parseFloat(speed.toFixed(2)),
        heading: parseFloat(heading.toFixed(1)),
      };
    }

    // Fallback — should not be reached
    const last = wps[wps.length - 1];
    return { latitude: last.latitude, longitude: last.longitude, altitude: last.altitude, speed: 0, heading: 0 };
  }

  // ── Deviation injection ───────────────────────────────────────────────────

  /**
   * Applies a perpendicular lateral offset in mode='deviation'
   * between [deviationFrom, deviationTo] fractions of the route.
   * @private
   */
  _applyDeviation(pos, routeFraction) {
    if (this.mode !== 'deviation') return pos;
    if (routeFraction < this.deviationFrom || routeFraction > this.deviationTo) return pos;

    // Offset perpendicular to current heading (90° CCW)
    const perpHeadingRad = toRad((pos.heading + 90) % 360);
    const deltaLat = toDeg((this.deviationOffset / EARTH_RADIUS));
    const deltaLng = toDeg(
      (this.deviationOffset / EARTH_RADIUS) /
      Math.cos(toRad(pos.latitude)),
    );

    return {
      ...pos,
      latitude: pos.latitude + deltaLat * Math.cos(perpHeadingRad),
      longitude: pos.longitude + deltaLng * Math.sin(perpHeadingRad),
    };
  }

  // ── Anti-collision separation check ──────────────────────────────────────

  /**
   * Checks current position against all other drones in sharedPositions.
   *
   * Algorithms:
   *   dXY (quãng đường) — haversine horizontal distance
   *   dZ  (độ cao)      — absolute altitude difference
   *   relSpeed (vận tốc tương đối) — magnitude of velocity difference vector
   *   TTC (thời gian)   — time to conflict = dXY / relSpeed
   *
   * @param {{ latitude, longitude, altitude, speed, heading }} pos
   * @returns {Array<{otherId, dXY, dZ, ttcSec, severity}>}
   */
  _checkSeparation(pos) {
    const warnings = [];

    for (const [otherId, other] of this.sharedPositions.entries()) {
      if (otherId === this.droneId) continue;

      // 1. Quãng đường: horizontal distance
      const dXY = haversineDistance(pos.latitude, pos.longitude, other.lat, other.lng);
      if (dXY > D_MIN * 5) continue; // Far enough — skip computation

      // 2. Độ cao: vertical separation
      const dZ = Math.abs(pos.altitude - (other.alt ?? 0));

      // 3. Vận tốc tương đối: velocity difference vector
      const hdg1 = toRad(pos.heading ?? 0);
      const hdg2 = toRad(other.heading ?? 0);
      const vx1 = (pos.speed ?? 0) * Math.sin(hdg1);
      const vy1 = (pos.speed ?? 0) * Math.cos(hdg1);
      const vx2 = (other.speed ?? 0) * Math.sin(hdg2);
      const vy2 = (other.speed ?? 0) * Math.cos(hdg2);
      const relSpeed = Math.sqrt((vx1 - vx2) ** 2 + (vy1 - vy2) ** 2);

      // 4. Thời gian tới va chạm (TTC)
      const ttcSec = relSpeed > 0.5 ? Math.round(dXY / relSpeed) : null;

      const severity =
        (dXY < D_MIN && dZ < H_MIN) ? 'CRITICAL' :
          (dXY < D_MIN * 2 && dZ < H_MIN * 2) ? 'HIGH' :
            'MEDIUM';

      warnings.push({ otherId, dXY: Math.round(dXY), dZ: Math.round(dZ), ttcSec, severity });
    }

    return warnings;
  }

  // ── Session lifecycle helpers ─────────────────────────────────────────────

  /** @private */
  async _startSession(baseUrl, token) {
    const res = await fetch(`${baseUrl}/api/flight-sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ flightPlanId: this.flightPlanId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(`startSession ${res.status}: ${err.message || err.error || JSON.stringify(err)}`);
    }
    const data = await res.json();
    this.sessionId = data._id || data.session?._id;
    return this.sessionId;
  }

  /** @private */
  async _endSession(baseUrl, token) {
    const res = await fetch(`${baseUrl}/api/flight-sessions/${this.sessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      console.warn(`  ⚠️  [${this._tag()}] endSession warning: ${err.message || res.statusText}`);
    }
  }

  /** @private */
  _connectSocket(wsUrl, token) {
    return new Promise((resolve, reject) => {
      this._socket = io(wsUrl, {
        path: '/ws',
        transports: ['websocket'],
        auth: { token },
        reconnection: false,
        timeout: 10_000,
      });

      this._socket.once('connect', () => resolve());
      this._socket.once('connect_error', (err) =>
        reject(new Error(`Socket connect failed: ${err.message}`)),
      );

      this._socket.on('alert', (alert) => {
        this.alertsReceived.push(alert);
        const icon = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'HIGH' ? '⚠️ ' : 'ℹ️ ';
        console.log(`  ${icon} [${this._tag()}] ALERT ${alert.type}: ${alert.message}`);
      });

      this._socket.on('disconnect', () => {
        if (this.status === 'FLYING') {
          console.warn(`  ⚡ [${this._tag()}] Socket disconnected mid-flight`);
        }
      });
    });
  }

  // ── Main fly loop ─────────────────────────────────────────────────────────

  /**
   * Core simulation loop.
   *
   * Each real-world tick advances simulation by `tickMs × timeScale` ms.
   * Example: timeScale=10, tickMs=1000 → 1s real = 10s simulated.
   * @private
   */
  _flyLoop() {
    const startMs = this.plannedStart.getTime();
    const totalDurMs = Math.max(1000, this.plannedEnd.getTime() - startMs);
    let elapsedSimMs = 0;

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        // Advance simulated time
        elapsedSimMs += this.tickMs * this.timeScale;

        if (elapsedSimMs >= totalDurMs) {
          clearInterval(interval);
          resolve();
          return;
        }

        const simTimeMs = startMs + elapsedSimMs;
        const routeFraction = elapsedSimMs / totalDurMs;

        // Position interpolation
        let pos = this.interpolateAt(simTimeMs);

        // Inject planned deviation (mode='deviation')
        pos = this._applyDeviation(pos, routeFraction);

        // Battery model
        if (this.mode === 'battery-drop') {
          this.batteryLevel = Math.max(0, 100 - routeFraction * 95);
        } else {
          this.batteryLevel = Math.max(10, 100 - routeFraction * 30);
        }

        // Update shared position map for inter-drone awareness
        this.sharedPositions.set(this.droneId, {
          lat: pos.latitude,
          lng: pos.longitude,
          alt: pos.altitude,
          speed: pos.speed,
          heading: pos.heading,
        });

        // Simulator-side anti-collision log
        const nearMiss = this._checkSeparation(pos);
        nearMiss.forEach((w) => {
          if (w.severity === 'CRITICAL') {
            const ttc = w.ttcSec != null ? ` TTC=${w.ttcSec}s` : '';
            console.log(`  💥 [${this._tag()}] NEAR-MISS ${w.severity} ↔ ${w.otherId.slice(-6)}: dXY=${w.dXY}m dZ=${w.dZ}m${ttc}`);
          }
        });

        this.tickCount++;

        // Emit telemetry
        if (this._socket?.connected && this.sessionId) {
          this._socket.emit('telemetry', {
            droneId: this.droneId,
            sessionId: this.sessionId,
            lat: pos.latitude,
            lng: pos.longitude,
            alt: pos.altitude,
            speed: pos.speed,
            heading: pos.heading,
            batteryLevel: parseFloat(this.batteryLevel.toFixed(1)),
            timestamp: Date.now(),
          });
        }
      }, this.tickMs);
    });
  }

  /**
   * Full lifecycle: connect → start session → fly → end session → disconnect.
   *
   * @param {string} baseUrl - e.g. 'http://localhost:3000'
   * @param {string} wsUrl   - e.g. 'http://localhost:3000'
   * @param {string} token   - JWT bearer token
   */
  async fly(baseUrl, wsUrl, token) {
    try {
      this.status = 'CONNECTING';
      await this._connectSocket(wsUrl, token);

      this.status = 'STARTING';
      await this._startSession(baseUrl, token);
      this._socket.emit('watch_session', { sessionId: this.sessionId });
      console.log(`  ✈️  [${this._tag()}] Airborne  session=...${this.sessionId.slice(-6)}`);

      this.status = 'FLYING';
      await this._flyLoop();

      this.status = 'LANDING';
      await this._endSession(baseUrl, token);
      console.log(`  🛬 [${this._tag()}] Landed    ticks=${this.tickCount}  alerts=${this.alertsReceived.length}  bat=${this.batteryLevel.toFixed(0)}%`);

      this.status = 'COMPLETED';
    } catch (err) {
      this.status = 'FAILED';
      console.error(`  ❌ [${this._tag()}] ${err.message}`);
    } finally {
      if (this._socket) {
        this._socket.disconnect();
        this._socket = null;
      }
    }
  }

  /** @private */
  _tag() { return `...${this.droneId.slice(-6)}`; }
}

module.exports = { FlightPlanFollower, haversineDistance, bearingTo, D_MIN, H_MIN };
