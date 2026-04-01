const { addPlanToMission, updateMissionPlan } = require("./mission.service");
const Mission = require("./mission.model");
const MissionPlan = require("./missionPlan.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const {
    pairwiseConflictCheck,
    segmentationConflictCheck,
} = require("../conflict/conflictDetection.service");
const { checkFlightPlanZoneViolations } = require("../conflict/zoneConflict.service");

jest.mock("./mission.model");
jest.mock("./missionPlan.model");
jest.mock("../flightPlan/flightPlan.model");
jest.mock("../conflict/conflictDetection.service", () => ({
    pairwiseConflictCheck: jest.fn(() => []),
    segmentationConflictCheck: jest.fn(() => []),
}));
jest.mock("../conflict/zoneConflict.service", () => ({
    checkFlightPlanZoneViolations: jest.fn(() => []),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────
const userId = "user123";
const role = "PILOT";
const missionId = "mission123";
const flightPlanId = "plan123";
const droneId = "drone123";

const mockFlightPlan = {
    _id: flightPlanId,
    pilot: userId,
    status: "APPROVED",
    drone: droneId,
    waypoints: [
        { sequenceNumber: 1, latitude: 10, longitude: 106, altitude: 100 },
        { sequenceNumber: 2, latitude: 10.01, longitude: 106.01, altitude: 100 },
    ],
    routeGeometry: {
        type: "LineString",
        coordinates: [[106, 10], [106.01, 10.01]],
    },
};

/** Helper: MissionPlan.find mock that resolves with an array, supporting chained .populate() */
function mockFindPlans(plans) {
    const mockQuery = {
        populate: jest.fn().mockResolvedValue(plans),
    };
    MissionPlan.find.mockReturnValue(mockQuery);
    return mockQuery;
}

/** Helper: a MissionPlan.create mock that returns a plan with .populate() */
function mockCreate() {
    const mockMissionPlan = {
        _id: "mp1",
        mission: missionId,
        flightPlan: flightPlanId,
        plannedStart: new Date(),
        plannedEnd: new Date(),
        populate: jest.fn().mockResolvedValue({ _id: "mp1" }),
    };
    MissionPlan.create.mockResolvedValue(mockMissionPlan);
    return mockMissionPlan;
}

// ─── addPlanToMission ─────────────────────────────────────────────────────────
describe("Mission Service — addPlanToMission", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Mission.findOne.mockResolvedValue({ _id: missionId, createdBy: userId });
        FlightPlan.findById.mockResolvedValue(mockFlightPlan);
        mockFindPlans([]); // No existing plans by default
        mockCreate();
    });

    test("should allow adding a plan when there are no conflicts", async () => {
        const data = {
            flightPlanId,
            plannedStart: "2026-03-19T10:00:00Z",
            plannedEnd: "2026-03-19T11:00:00Z",
        };
        await addPlanToMission(missionId, data, userId, role);
        expect(MissionPlan.create).toHaveBeenCalledWith(
            expect.objectContaining({ mission: missionId, flightPlan: flightPlanId }),
        );
    });

    test("should allow adding the same flight plan multiple times at different intervals", async () => {
        const data1 = {
            flightPlanId,
            plannedStart: "2026-03-19T10:00:00Z",
            plannedEnd: "2026-03-19T11:00:00Z",
        };
        await addPlanToMission(missionId, data1, userId, role);
        expect(MissionPlan.create).toHaveBeenCalledTimes(1);

        const data2 = {
            flightPlanId,
            plannedStart: "2026-03-19T14:00:00Z",
            plannedEnd: "2026-03-19T15:00:00Z",
        };
        await addPlanToMission(missionId, data2, userId, role);
        expect(MissionPlan.create).toHaveBeenCalledTimes(2);
    });

    test("should block adding when same-drone overlap exists within the mission", async () => {
        // assertNoDroneOverlapInMission query returns an overlapping plan
        const overlappingPlan = {
            _id: "existing_mp",
            mission: missionId,
            status: "SCHEDULED",
            plannedStart: new Date("2026-03-19T10:00:00Z"),
            plannedEnd: new Date("2026-03-19T11:00:00Z"),
            flightPlan: { drone: droneId },
        };
        const mockQuery = {
            populate: jest.fn().mockResolvedValue([overlappingPlan]),
        };
        MissionPlan.find.mockReturnValue(mockQuery);

        const data = {
            flightPlanId,
            plannedStart: "2026-03-19T10:30:00Z",
            plannedEnd: "2026-03-19T11:30:00Z",
        };

        await expect(addPlanToMission(missionId, data, userId, role))
            .rejects.toThrow("Mission schedule overlaps for the same drone");
    });

    test("should block adding when pairwise conflict detected (cross-mission)", async () => {
        // No internal overlap (find returns [] for drone check), but pairwise check returns a conflict
        pairwiseConflictCheck.mockReturnValueOnce([
            {
                flightPlans: [flightPlanId, "other_plan"],
                detectionMethod: "PAIRWISE",
                severity: "HIGH",
            },
        ]);

        const data = {
            flightPlanId,
            plannedStart: "2026-03-19T10:00:00Z",
            plannedEnd: "2026-03-19T11:00:00Z",
        };

        const err = await addPlanToMission(missionId, data, userId, role).catch(e => e);
        expect(err.name).toBe("ValidationError");
        expect(err.details.pairwiseConflicts).toHaveLength(1);
        expect(MissionPlan.create).not.toHaveBeenCalled();
    });

    test("should block adding when zone violation detected", async () => {
        checkFlightPlanZoneViolations.mockResolvedValueOnce([
            { violatedZone: "zone1", severity: "CRITICAL", detectionMethod: "ZONE_VIOLATION" },
        ]);

        const data = {
            flightPlanId,
            plannedStart: "2026-03-19T10:00:00Z",
            plannedEnd: "2026-03-19T11:00:00Z",
        };

        const err = await addPlanToMission(missionId, data, userId, role).catch(e => e);
        expect(err.name).toBe("ValidationError");
        expect(err.details.zoneViolations).toHaveLength(1);
        expect(MissionPlan.create).not.toHaveBeenCalled();
    });
});

// ─── updateMissionPlan ────────────────────────────────────────────────────────
describe("Mission Service — updateMissionPlan (time change re-check)", () => {
    const missionPlanId = "mp_existing";

    const existingMissionPlan = {
        _id: missionPlanId,
        mission: missionId,
        status: "SCHEDULED",
        plannedStart: new Date("2026-03-19T08:00:00Z"),
        plannedEnd: new Date("2026-03-19T09:00:00Z"),
        flightPlan: {
            ...mockFlightPlan,
            drone: droneId,
        },
        order: 1,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue({ _id: missionPlanId }),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        Mission.findOne.mockResolvedValue({ _id: missionId, createdBy: userId });

        // MissionPlan.findOne (for the plan being updated)
        MissionPlan.findOne = jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(existingMissionPlan),
        });

        // MissionPlan.find is called up to 3 times:
        //   1. assertNoDroneOverlapInMission (drone check, returns [])
        //   2. getInternalTrajectories (returns [])
        //   3. getCrossMissionTrajectories (returns [])
        // Default: always return an empty array via the chained .populate()
        MissionPlan.find.mockReturnValue({
            populate: jest.fn().mockResolvedValue([]),
        });
    });

    test("should re-run conflict check when plannedStart changes and block on conflict", async () => {
        pairwiseConflictCheck.mockReturnValueOnce([
            { flightPlans: [flightPlanId, "other"], detectionMethod: "PAIRWISE", severity: "HIGH" },
        ]);

        const err = await updateMissionPlan(
            missionId, missionPlanId,
            // Pass BOTH start and end so plannedEnd > plannedStart (avoids time-ordering error)
            { plannedStart: "2026-03-19T10:00:00Z", plannedEnd: "2026-03-19T11:00:00Z" },
            userId, role,
        ).catch(e => e);

        expect(err.name).toBe("ValidationError");
        expect(err.details).toBeDefined();
        expect(err.details.pairwiseConflicts).toHaveLength(1);
    });

    test("should NOT re-run conflict check when only notes change (no time change)", async () => {
        await updateMissionPlan(
            missionId, missionPlanId,
            { notes: "Updated note" },
            userId, role,
        );

        expect(pairwiseConflictCheck).not.toHaveBeenCalled();
    });
});

