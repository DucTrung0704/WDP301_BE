const missionService = require("./mission.service");

function mapErrorToResponse(err, res, fallbackMessage) {
    if (
        err.message.includes("Unauthorized") ||
        err.message.includes("don't own")
    ) {
        return res.status(403).json({ message: err.message });
    }

    if (err.message.includes("not found")) {
        return res.status(404).json({ message: err.message });
    }

    if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message, details: err.details });
    }

    return res.status(500).json({ message: fallbackMessage, error: err.message });
}

exports.createMission = async (req, res) => {
    try {
        const mission = await missionService.createMission(req.body, req.user.id);
        await mission.populate("createdBy", "email profile.fullName role");

        return res.status(201).json(mission);
    } catch (err) {
        console.error("Create mission error:", err);
        return mapErrorToResponse(err, res, "Create mission failed");
    }
};

exports.listMissions = async (req, res) => {
    try {
        const missions = await missionService.listMissions(req.user.id, req.user.role);
        return res.json(missions);
    } catch (err) {
        console.error("List missions error:", err);
        return mapErrorToResponse(err, res, "List missions failed");
    }
};

exports.getMissionDetail = async (req, res) => {
    try {
        const data = await missionService.getMissionDetail(
            req.params.id,
            req.user.id,
            req.user.role,
        );

        return res.json(data);
    } catch (err) {
        console.error("Get mission detail error:", err);
        return mapErrorToResponse(err, res, "Get mission detail failed");
    }
};

exports.updateMission = async (req, res) => {
    try {
        const mission = await missionService.updateMission(
            req.params.id,
            req.body,
            req.user.id,
            req.user.role,
        );

        await mission.populate("createdBy", "email profile.fullName role");
        return res.json(mission);
    } catch (err) {
        console.error("Update mission error:", err);
        return mapErrorToResponse(err, res, "Update mission failed");
    }
};

exports.addPlanToMission = async (req, res) => {
    try {
        const missionPlan = await missionService.addPlanToMission(
            req.params.id,
            req.body,
            req.user.id,
            req.user.role,
        );

        return res.status(201).json(missionPlan);
    } catch (err) {
        console.error("Add plan to mission error:", err);
        return mapErrorToResponse(err, res, "Add plan to mission failed");
    }
};

exports.updateMissionPlan = async (req, res) => {
    try {
        const missionPlan = await missionService.updateMissionPlan(
            req.params.id,
            req.params.missionPlanId,
            req.body,
            req.user.id,
            req.user.role,
        );

        return res.json(missionPlan);
    } catch (err) {
        console.error("Update mission plan error:", err);
        return mapErrorToResponse(err, res, "Update mission plan failed");
    }
};

exports.removePlanFromMission = async (req, res) => {
    try {
        const missionPlan = await missionService.removePlanFromMission(
            req.params.id,
            req.params.missionPlanId,
            req.user.id,
            req.user.role,
        );

        return res.json({ message: "Plan removed from mission", missionPlan });
    } catch (err) {
        console.error("Remove plan from mission error:", err);
        return mapErrorToResponse(err, res, "Remove plan from mission failed");
    }
};

exports.deleteMission = async (req, res) => {
    try {
        const deleted = await missionService.deleteMission(
            req.params.id,
            req.user.id,
            req.user.role,
        );

        return res.json({
            message: "Mission deleted successfully",
            missionId: deleted._id,
        });
    } catch (err) {
        console.error("Delete mission error:", err);
        return mapErrorToResponse(err, res, "Delete mission failed");
    }
};

exports.startMission = async (req, res) => {
    try {
        const result = await missionService.startMission(
            req.params.id,
            req.user.id,
            req.user.role,
        );

        await result.mission.populate("createdBy", "email profile.fullName role");

        return res.json({
            message: "Mission started successfully",
            ...result,
        });
    } catch (err) {
        console.error("Start mission error:", err);
        return mapErrorToResponse(err, res, "Start mission failed");
    }
};