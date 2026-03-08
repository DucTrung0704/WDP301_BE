const express = require("express");
const router = express.Router();
const controller = require("./alert.controller");
const {
  authenticate,
  authorizeRoles,
} = require("../../../middleware/auth.middleware");

// All routes require authentication
router.use(authenticate);

// List alerts
router.get(
  "/",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  controller.list,
);

// Alert detail
router.get(
  "/:id",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  controller.getById,
);

// Acknowledge alert
router.put(
  "/:id/acknowledge",
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  controller.acknowledge,
);

module.exports = router;
