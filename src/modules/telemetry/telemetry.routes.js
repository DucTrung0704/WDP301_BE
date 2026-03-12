const express = require("express");
const router = express.Router();
const {
  processTelemetry,
  getSessionTelemetry,
  getAggregatedTelemetry,
} = require("./telemetry.service");
const FlightSession = require("../flightSession/flightSession.model");
const {
  authenticate,
  authorizeRoles,
} = require("../../../middleware/auth.middleware");

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/telemetry
 * REST fallback for sending telemetry (when WebSocket is unavailable)
 */
router.post(
  "/",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  async (req, res) => {
    try {
      const { sessionId, lat, lng, altitude, speed, heading, batteryLevel } =
        req.body;

      if (!sessionId || lat == null || lng == null || altitude == null) {
        return res.status(400).json({
          message: "sessionId, lat, lng, altitude are required",
        });
      }

      // Ownership check
      const session = await FlightSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Flight session not found" });
      }
      if (session.pilot.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const telemetry = await processTelemetry(sessionId, {
        lat,
        lng,
        altitude,
        speed,
        heading,
        batteryLevel,
      });

      return res.status(201).json(telemetry);
    } catch (err) {
      if (err.message.includes("not found")) {
        return res.status(404).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message });
    }
  },
);

/**
 * GET /api/telemetry/:sessionId
 * Get telemetry history for a session
 */
router.get(
  "/:sessionId",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  async (req, res) => {
    try {
      // Ownership check
      const session = await FlightSession.findById(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ message: "Flight session not found" });
      }
      if (
        req.user.role !== "UTM_ADMIN" &&
        session.pilot.toString() !== req.user.id.toString()
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { page, limit } = req.query;
      const result = await getSessionTelemetry(req.params.sessionId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 100,
      });

      return res.json(result);
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
);

/**
 * GET /api/telemetry/:sessionId/aggregated
 * Get aggregated telemetry data (min/max/avg) for analytics/dashboards
 * Supports time-based bucketing to reduce data transfer
 */
router.get(
  "/:sessionId/aggregated",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  async (req, res) => {
    try {
      // Ownership check
      const session = await FlightSession.findById(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ message: "Flight session not found" });
      }
      if (
        req.user.role !== "UTM_ADMIN" &&
        session.pilot.toString() !== req.user.id.toString()
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Bucket size in milliseconds (default: 60 seconds)
      const bucketSize = parseInt(req.query.bucketSize) || 60000;
      const result = await getAggregatedTelemetry(req.params.sessionId, bucketSize);

      return res.json({
        sessionId: req.params.sessionId,
        bucketSizeMs: bucketSize,
        data: result,
      });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  },
);

module.exports = router;
