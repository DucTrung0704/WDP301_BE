const Mission = require("./mission.model");
const MissionPlan = require("./missionPlan.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const {
    pairwiseConflictCheck,
    segmentationConflictCheck,
} = require("../conflict/conflictDetection.service");
const { checkFlightPlanZoneViolations } = require("../conflict/zoneConflict.service");

function createValidationError(message) {
    const err = new Error(message);
    err.name = "ValidationError";
    return err;
}

function assertValid(condition, message) {
    if (!condition) {
        throw createValidationError(message);
    }
}

function parseDate(value, fieldName) {
    const parsed = new Date(value);
    assertValid(!Number.isNaN(parsed.getTime()), `${fieldName} must be a valid date.`);
    return parsed;
}

async function getMissionForUser(missionId, userId, role) {
    const query = { _id: missionId };
    if (role !== "UTM_ADMIN") {
        query.createdBy = userId;
    }

    const mission = await Mission.findOne(query);
    if (!mission) {
        throw new Error("Mission not found");
    }

    return mission;
}

async function assertFlightPlanUsableForMission(flightPlanId, userId, role) {
    const flightPlan = await FlightPlan.findById(flightPlanId);
    if (!flightPlan) {
        throw new Error("Flight plan not found");
    }

    if (role !== "UTM_ADMIN" && flightPlan.pilot.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You don't own this flight plan");
    }

    if (!["DRAFT", "APPROVED"].includes(flightPlan.status)) {
        throw createValidationError(
            `Cannot add flight plan with status "${flightPlan.status}" to mission.`,
        );
    }

    return flightPlan;
}

async function assertNoDroneOverlapInMission({
    missionId,
    droneId,
    plannedStart,
    plannedEnd,
    excludeMissionPlanId,
}) {
    const overlappingMissionPlans = await MissionPlan.find({
        mission: missionId,
        status: "SCHEDULED",
        plannedStart: { $lt: plannedEnd },
        plannedEnd: { $gt: plannedStart },
        ...(excludeMissionPlanId ? { _id: { $ne: excludeMissionPlanId } } : {}),
    }).populate("flightPlan", "drone");

    const hasOverlap = overlappingMissionPlans.some(
        (missionPlan) =>
            missionPlan.flightPlan &&
            missionPlan.flightPlan.drone &&
            missionPlan.flightPlan.drone.toString() === droneId.toString(),
    );

    if (hasOverlap) {
        throw createValidationError(
            "Mission schedule overlaps for the same drone. Adjust plannedStart/plannedEnd.",
        );
    }
}

async function createMission(data, userId) {
    assertValid(data && typeof data === "object", "Invalid payload.");
    assertValid(data.name && data.name.trim(), "name is required.");

    const mission = await Mission.create({
        name: data.name.trim(),
        description: data.description,
        status: data.status || "DRAFT",
        createdBy: userId,
    });

    return mission;
}

async function listMissions(userId, role) {
    const query = role === "UTM_ADMIN" ? {} : { createdBy: userId };

    return Mission.find(query)
        .populate("createdBy", "email profile.fullName role")
        .sort({ createdAt: -1 });
}

async function getMissionDetail(missionId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    const missionPlans = await MissionPlan.find({ mission: mission._id })
        .populate("flightPlan")
        .sort({ order: 1, plannedStart: 1, createdAt: 1 });

    return { mission, missionPlans };
}

async function updateMission(missionId, data, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    if (data.name !== undefined) {
        assertValid(data.name && data.name.trim(), "name cannot be empty.");
        mission.name = data.name.trim();
    }

    if (data.description !== undefined) {
        mission.description = data.description;
    }

    if (data.status !== undefined) {
        assertValid(
            ["DRAFT", "ACTIVE", "ARCHIVED"].includes(data.status),
            "status must be one of DRAFT, ACTIVE, ARCHIVED.",
        );
        mission.status = data.status;
    }

    await mission.save();
    return mission;
}

async function addPlanToMission(missionId, data, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    assertValid(data && typeof data === "object", "Invalid payload.");
    assertValid(data.flightPlanId, "flightPlanId is required.");

    const plannedStart = parseDate(data.plannedStart, "plannedStart");
    const plannedEnd = parseDate(data.plannedEnd, "plannedEnd");
    assertValid(plannedEnd > plannedStart, "plannedEnd must be after plannedStart.");

    const flightPlan = await assertFlightPlanUsableForMission(
        data.flightPlanId,
        userId,
        role,
    );

    await assertNoDroneOverlapInMission({
        missionId: mission._id,
        droneId: flightPlan.drone,
        plannedStart,
        plannedEnd,
    });

    const checks = await runMissionAddChecks({
        missionId: mission._id,
        flightPlan,
        plannedStart,
        plannedEnd,
    });

    if (checks.hasBlockingIssues) {
        const err = createValidationError(
            "Không thể thêm plan vào mission vì phát hiện conflict/zone violation trong khung thời gian đã chọn.",
        );
        err.details = {
            notification: "Conflict được phát hiện ngay khi thêm plan. Vui lòng điều chỉnh thời gian hoặc lộ trình.",
            pairwiseConflicts: checks.pairwiseConflicts,
            segmentationConflicts: checks.segmentationConflicts,
            zoneViolations: checks.zoneViolations,
        };
        throw err;
    }

    const missionPlan = await MissionPlan.create({
        mission: mission._id,
        flightPlan: flightPlan._id,
        plannedStart,
        plannedEnd,
        order: data.order || 1,
        notes: data.notes,
    });

    return missionPlan.populate("flightPlan");
}

async function updateMissionPlan(
    missionId,
    missionPlanId,
    data,
    userId,
    role,
) {
    const mission = await getMissionForUser(missionId, userId, role);

    const missionPlan = await MissionPlan.findOne({
        _id: missionPlanId,
        mission: mission._id,
    }).populate("flightPlan", "drone pilot status");

    if (!missionPlan) {
        throw new Error("Mission plan not found");
    }

    const plannedStart =
        data.plannedStart ?
            parseDate(data.plannedStart, "plannedStart")
            : missionPlan.plannedStart;
    const plannedEnd =
        data.plannedEnd ? parseDate(data.plannedEnd, "plannedEnd") : missionPlan.plannedEnd;

    assertValid(plannedEnd > plannedStart, "plannedEnd must be after plannedStart.");

    await assertNoDroneOverlapInMission({
        missionId: mission._id,
        droneId: missionPlan.flightPlan.drone,
        plannedStart,
        plannedEnd,
        excludeMissionPlanId: missionPlan._id,
    });

    missionPlan.plannedStart = plannedStart;
    missionPlan.plannedEnd = plannedEnd;

    if (data.order !== undefined) {
        assertValid(Number.isInteger(data.order) && data.order >= 1, "order must be >= 1.");
        missionPlan.order = data.order;
    }

    if (data.status !== undefined) {
        assertValid(
            ["SCHEDULED", "CANCELLED"].includes(data.status),
            "status must be one of SCHEDULED, CANCELLED.",
        );
        missionPlan.status = data.status;
    }

    if (data.notes !== undefined) {
        missionPlan.notes = data.notes;
    }

    await missionPlan.save();
    return missionPlan.populate("flightPlan");
}

async function removePlanFromMission(missionId, missionPlanId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    const missionPlan = await MissionPlan.findOneAndDelete({
        _id: missionPlanId,
        mission: mission._id,
    });

    if (!missionPlan) {
        throw new Error("Mission plan not found");
    }

    return missionPlan;
}

async function deleteMission(missionId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    await MissionPlan.deleteMany({ mission: mission._id });
    await Mission.deleteOne({ _id: mission._id });

    return { _id: mission._id };
}

function mapMissionPlanToScheduledTrajectory(missionPlan) {
    const flightPlan = missionPlan.flightPlan;
    const sortedWaypoints = [...(flightPlan.waypoints || [])].sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber,
    );

    const startMs = new Date(missionPlan.plannedStart).getTime();
    const endMs = new Date(missionPlan.plannedEnd).getTime();
    const durationMs = Math.max(1000, endMs - startMs);
    const segments = Math.max(1, sortedWaypoints.length - 1);

    const waypoints = sortedWaypoints.map((waypoint, index) => ({
        sequenceNumber: waypoint.sequenceNumber,
        latitude: waypoint.latitude,
        longitude: waypoint.longitude,
        altitude: waypoint.altitude,
        speed: waypoint.speed,
        action: waypoint.action,
        estimatedTime: new Date(startMs + (durationMs * index) / segments),
    }));

    return {
        _id: flightPlan._id,
        missionPlanId: missionPlan._id,
        plannedStart: missionPlan.plannedStart,
        plannedEnd: missionPlan.plannedEnd,
        routeGeometry: flightPlan.routeGeometry,
        waypoints,
    };
}

function deduplicateConflicts(conflicts) {
    const map = new Map();

    for (const conflict of conflicts) {
        const key = conflict.flightPlans
            .map((id) => id.toString())
            .sort()
            .join("_");

        if (!map.has(key)) {
            map.set(key, conflict);
        }
    }

    return [...map.values()];
}

function mergeSegmentationWithoutPairwiseDuplicates(
    pairwiseConflicts,
    segmentationConflicts,
) {
    const deduplicatedSegmentation = deduplicateConflicts(segmentationConflicts);

    const pairwisePairs = new Set(
        pairwiseConflicts.map((conflict) =>
            conflict.flightPlans
                .map((id) => id.toString())
                .sort()
                .join("_"),
        ),
    );

    return deduplicatedSegmentation.filter((conflict) => {
        const pairKey = conflict.flightPlans
            .map((id) => id.toString())
            .sort()
            .join("_");

        return !pairwisePairs.has(pairKey);
    });
}

async function runMissionAddChecks({ missionId, flightPlan, plannedStart, plannedEnd }) {
    const existingMissionPlans = await MissionPlan.find({
        mission: missionId,
        status: "SCHEDULED",
    }).populate("flightPlan");

    const candidateMissionPlan = {
        _id: `candidate_${flightPlan._id.toString()}`,
        flightPlan,
        plannedStart,
        plannedEnd,
    };

    const candidateTrajectory = mapMissionPlanToScheduledTrajectory(candidateMissionPlan);
    const existingTrajectories = existingMissionPlans.map(mapMissionPlanToScheduledTrajectory);

    const pairwiseConflicts = deduplicateConflicts(
        pairwiseConflictCheck(candidateTrajectory, existingTrajectories),
    );

    const segmentationConflicts = mergeSegmentationWithoutPairwiseDuplicates(
        pairwiseConflicts,
        segmentationConflictCheck(candidateTrajectory, existingTrajectories),
    );

    const zoneViolations = await checkFlightPlanZoneViolations(candidateTrajectory);

    return {
        pairwiseConflicts,
        segmentationConflicts,
        zoneViolations,
        hasBlockingIssues:
            pairwiseConflicts.length > 0 ||
            segmentationConflicts.length > 0 ||
            zoneViolations.length > 0,
    };
}

async function runMissionStartChecks(missionPlans) {
    const scheduledTrajectories = missionPlans.map(mapMissionPlanToScheduledTrajectory);

    let pairwiseConflicts = [];
    let segmentationConflicts = [];

    for (let index = 0; index < scheduledTrajectories.length; index += 1) {
        const current = scheduledTrajectories[index];
        const others = scheduledTrajectories.filter((_, i) => i !== index);

        pairwiseConflicts.push(...pairwiseConflictCheck(current, others));
        segmentationConflicts.push(...segmentationConflictCheck(current, others));
    }

    pairwiseConflicts = deduplicateConflicts(pairwiseConflicts);
    segmentationConflicts = mergeSegmentationWithoutPairwiseDuplicates(
        pairwiseConflicts,
        segmentationConflicts,
    );

    const zoneViolationsNested = await Promise.all(
        scheduledTrajectories.map((trajectory) =>
            checkFlightPlanZoneViolations({
                ...trajectory,
                _id: trajectory._id,
            }),
        ),
    );

    const zoneViolations = zoneViolationsNested.flat();

    return {
        pairwiseConflicts,
        segmentationConflicts,
        zoneViolations,
        hasBlockingIssues:
            pairwiseConflicts.length > 0 ||
            segmentationConflicts.length > 0 ||
            zoneViolations.length > 0,
    };
}

async function startMission(missionId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    if (mission.status === "ARCHIVED") {
        throw createValidationError("Cannot start archived mission.");
    }

    const missionPlans = await MissionPlan.find({
        mission: mission._id,
        status: "SCHEDULED",
    }).populate("flightPlan");

    assertValid(
        missionPlans.length > 0,
        "Mission must contain at least one scheduled plan before start.",
    );

    const checks = await runMissionStartChecks(missionPlans);

    if (checks.hasBlockingIssues) {
        const err = createValidationError(
            "Mission start blocked by conflicts or zone violations.",
        );
        err.details = {
            pairwiseConflicts: checks.pairwiseConflicts,
            segmentationConflicts: checks.segmentationConflicts,
            zoneViolations: checks.zoneViolations,
        };
        throw err;
    }

    mission.status = "ACTIVE";
    await mission.save();

    return {
        mission,
        checks: {
            pairwiseConflicts: 0,
            segmentationConflicts: 0,
            zoneViolations: 0,
        },
    };
}

module.exports = {
    createMission,
    listMissions,
    getMissionDetail,
    updateMission,
    addPlanToMission,
    updateMissionPlan,
    removePlanFromMission,
    deleteMission,
    startMission,
};