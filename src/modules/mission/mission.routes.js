const express = require("express");
const router = express.Router();
const {
    authenticate,
    authorizeRoles,
} = require("../../../middleware/auth.middleware");
const missionController = require("./mission.controller");

router.post(
    "/",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.createMission,
);

router.get(
    "/",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.listMissions,
);

router.get(
    "/:id",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.getMissionDetail,
);

router.put(
    "/:id",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.updateMission,
);

router.delete(
    "/:id",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.deleteMission,
);

router.post(
    "/:id/start",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.startMission,
);

router.post(
    "/:id/plans",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.addPlanToMission,
);

router.put(
    "/:id/plans/:missionPlanId",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.updateMissionPlan,
);

router.delete(
    "/:id/plans/:missionPlanId",
    authenticate,
    authorizeRoles("FLEET_OPERATOR"),
    missionController.removePlanFromMission,
);

module.exports = router;
