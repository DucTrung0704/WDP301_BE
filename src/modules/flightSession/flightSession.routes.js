const express = require("express");
const router = express.Router();
const controller = require("./flightSession.controller");
const {
  authenticate,
  authorizeRoles,
} = require("../../../middleware/auth.middleware");

// All routes require authentication
router.use(authenticate);

// Start a planned session (INDIVIDUAL_OPERATOR + FLEET_OPERATOR)
router.post(
  "/start",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  controller.startPlanned,
);

// Start a free flight (INDIVIDUAL_OPERATOR only)
router.post(
  "/free-flight",
  authorizeRoles("INDIVIDUAL_OPERATOR"),
  controller.startFreeFlight,
);

// List sessions
router.get(
  "/",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  controller.list,
);

// Session detail
router.get(
  "/:id",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  controller.getById,
);

// End session
router.post(
  "/:id/end",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  controller.endSession,
);

// Abort session
router.post(
  "/:id/abort",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  controller.abortSession,
);

// Emergency land
router.post(
  "/:id/emergency",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  controller.emergencyLand,
);

// Get session telemetry
router.get(
  "/:id/telemetry",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  controller.getSessionTelemetry,
);

// Get session alerts
router.get(
  "/:id/alerts",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  controller.getSessionAlerts,
);

module.exports = router;
