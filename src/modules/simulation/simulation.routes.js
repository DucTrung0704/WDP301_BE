const express = require("express");
const router = express.Router();
const controller = require("./simulation.controller");
const {
  authenticate,
  authorizeRoles,
} = require("../../../middleware/auth.middleware");

router.use(authenticate);

router.post(
  "/missions/:id/start",
  authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
  controller.startMissionSimulation,
);

router.post(
  "/:runId/stop",
  authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
  controller.stopSimulation,
);

router.get(
  "/:runId/status",
  authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
  controller.getSimulationStatus,
);

module.exports = router;
