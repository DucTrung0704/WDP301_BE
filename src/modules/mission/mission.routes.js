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
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.listMissions,
);

router.get(
    "/:id",
    authenticate,
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.getMissionDetail,
);

router.put(
    "/:id",
    authenticate,
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.updateMission,
);

router.delete(
    "/:id",
    authenticate,
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.deleteMission,
);

router.post(
    "/:id/start",
    authenticate,
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.startMission,
);

router.post(
    "/:id/plans",
    authenticate,
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.addPlanToMission,
);

router.put(
    "/:id/plans/:missionPlanId",
    authenticate,
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.updateMissionPlan,
);

router.delete(
    "/:id/plans/:missionPlanId",
    authenticate,
    authorizeRoles("FLEET_OPERATOR", "UTM_ADMIN"),
    missionController.removePlanFromMission,
);

module.exports = router;
