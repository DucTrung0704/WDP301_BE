const { addPlanToMission } = require("./mission.service");
const Mission = require("./mission.model");
const MissionPlan = require("./missionPlan.model");
const FlightPlan = require("../flightPlan/flightPlan.model");

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

describe("Mission Service - addPlanToMission", () => {
    const userId = "user123";
    const role = "PILOT";
    const missionId = "mission123";
    const flightPlanId = "plan123";
    const droneId = "drone123";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should allow adding the same flight plan multiple times at different intervals", async () => {
        // Mock Mission.findOne (via getMissionForUser)
        Mission.findOne.mockResolvedValue({ _id: missionId, createdBy: userId });

        // Mock FlightPlan.findById (via assertFlightPlanUsableForMission)
        FlightPlan.findById.mockResolvedValue({
            _id: flightPlanId,
            pilot: userId,
            status: "APPROVED",
            drone: droneId,
        });

        // Mock MissionPlan.find (via assertNoDroneOverlapInMission and runMissionAddChecks)
        const mockQuery = {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve([])),
            catch: jest.fn(),
        };
        MissionPlan.find.mockReturnValue(mockQuery);

        // Mock MissionPlan.create
        const mockMissionPlan = {
            _id: "mp1",
            mission: missionId,
            flightPlan: flightPlanId,
            plannedStart: new Date(),
            plannedEnd: new Date(),
            populate: jest.fn().mockResolvedValue({ _id: "mp1" }),
        };
        MissionPlan.create.mockResolvedValue(mockMissionPlan);

        // Add first time
        const data1 = {
            flightPlanId,
            plannedStart: "2026-03-19T10:00:00Z",
            plannedEnd: "2026-03-19T11:00:00Z",
        };
        await addPlanToMission(missionId, data1, userId, role);

        expect(MissionPlan.create).toHaveBeenCalledWith(expect.objectContaining({
            mission: missionId,
            flightPlan: flightPlanId,
            plannedStart: new Date(data1.plannedStart),
            plannedEnd: new Date(data1.plannedEnd),
        }));

        // Add second time (different interval)
        const data2 = {
            flightPlanId,
            plannedStart: "2026-03-19T14:00:00Z",
            plannedEnd: "2026-03-19T15:00:00Z",
        };
        await addPlanToMission(missionId, data2, userId, role);

        expect(MissionPlan.create).toHaveBeenCalledTimes(2);
        expect(MissionPlan.create).toHaveBeenLastCalledWith(expect.objectContaining({
            mission: missionId,
            flightPlan: flightPlanId,
            plannedStart: new Date(data2.plannedStart),
            plannedEnd: new Date(data2.plannedEnd),
        }));
    });

    test("should block adding the same flight plan if times overlap", async () => {
        Mission.findOne.mockResolvedValue({ _id: missionId, createdBy: userId });
        FlightPlan.findById.mockResolvedValue({
            _id: flightPlanId,
            pilot: userId,
            status: "APPROVED",
            drone: droneId,
        });

        // Mock an overlapping MissionPlan in DB
        const mockOverlappingPlan = {
            _id: "existing_mp",
            mission: missionId,
            status: "SCHEDULED",
            plannedStart: new Date("2026-03-19T10:00:00Z"),
            plannedEnd: new Date("2026-03-19T11:00:00Z"),
            flightPlan: { drone: droneId },
        };
        const mockQueryOverlap = {
            populate: jest.fn().mockReturnThis(),
            then: jest.fn((resolve) => resolve([mockOverlappingPlan])),
        };
        MissionPlan.find.mockReturnValue(mockQueryOverlap);

        const dataOverlap = {
            flightPlanId,
            plannedStart: "2026-03-19T10:30:00Z",
            plannedEnd: "2026-03-19T11:30:00Z",
        };

        await expect(addPlanToMission(missionId, dataOverlap, userId, role))
            .rejects.toThrow("Mission schedule overlaps for the same drone");
    });
});
