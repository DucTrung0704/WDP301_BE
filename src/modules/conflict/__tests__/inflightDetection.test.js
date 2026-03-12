/**
 * Unit tests for inflightDetection.service.js
 *
 * Tests the 4 in-flight checks:
 * 1. Proximity Check
 * 2. Zone Violation Check
 * 3. Deviation Check (PLANNED only)
 * 4. Battery Check
 *
 * Uses mocks to avoid MongoDB dependency.
 */

// Mock all dependencies before requiring the module
jest.mock("../../conflict/conflictEvent.model");
jest.mock("../../flightSession/flightSession.model");
jest.mock("../../telemetry/telemetry.model");
jest.mock("../../../../models/zone.model");
jest.mock("../../alert/alert.service");
jest.mock("../../flightPlan/flightPlan.model");
jest.mock("../../../config/redis", () => ({
  cacheOps: {
    getAllDroneLocations: jest.fn(),
    setDroneLocation: jest.fn(),
    getDroneLocation: jest.fn(),
  },
  streamOps: {},
  REDIS_KEYS: {},
}));

const ConflictEvent = require("../../conflict/conflictEvent.model");
const FlightSession = require("../../flightSession/flightSession.model");
const Telemetry = require("../../telemetry/telemetry.model");
const { cacheOps } = require("../../../config/redis");
const Zone = require("../../../../models/zone.model");
const FlightPlan = require("../../flightPlan/flightPlan.model");
const { createAlert } = require("../../alert/alert.service");
const {
  runInflightChecks,
} = require("../../conflict/inflightDetection.service");

// Helper factories
function makeTelemetry(lat, lng, altitude, batteryLevel = 85) {
  return {
    location: {
      type: "Point",
      coordinates: [lng, lat],
    },
    altitude,
    batteryLevel,
    timestamp: new Date(),
  };
}

function makeSession(overrides = {}) {
  return {
    _id: "session1",
    drone: { _id: "drone1" },
    flightPlan: "plan1",
    sessionType: "PLANNED",
    status: "IN_PROGRESS",
    ...overrides,
  };
}

describe("In-flight Detection Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createAlert.mockResolvedValue({ _id: "alert1" });
    ConflictEvent.create = jest.fn().mockResolvedValue({ _id: "conflict1" });
    // Default: no other drones visible → proximity check returns early
    cacheOps.getAllDroneLocations.mockResolvedValue([]);
  });

  // ====================================
  // 1. Proximity Check
  // ====================================
  describe("Proximity Check", () => {
    it("should create alert when drones are too close", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100);

      // Another drone at same position in Redis cache
      cacheOps.getAllDroneLocations.mockResolvedValue([
        { droneId: "drone2", lat: 10.8231, lng: 106.6297, alt: 100 },
      ]);
      // Map droneId → sessionId (new code uses .select() chain)
      FlightSession.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: "session2", drone: "drone2" },
        ]),
      });
      FlightSession.findById = jest.fn().mockResolvedValue({
        _id: "session2",
        flightPlan: "plan2",
      });

      await runInflightChecks(session, telemetry);

      // Should create conflict event AND alert
      expect(ConflictEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          detectionMethod: "REALTIME",
          status: "ACTIVE",
        }),
      );
      expect(createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CONFLICT",
          flightSession: "session1",
        }),
      );
    });

    it("should NOT create alert when drones are far apart", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100);

      // Another drone ~11km away in Redis cache → no proximity alert
      cacheOps.getAllDroneLocations.mockResolvedValue([
        { droneId: "drone2", lat: 10.9231, lng: 106.7297, alt: 100 },
      ]);
      FlightSession.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue([
          { _id: "session2", drone: "drone2" },
        ]),
      });

      await runInflightChecks(session, telemetry);

      expect(ConflictEvent.create).not.toHaveBeenCalled();
    });

    it("should skip when no other sessions active", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100);

      // getAllDroneLocations returns [] by default (set in beforeEach)
      // proximityCheck returns early → no conflict

      await runInflightChecks(session, telemetry);

      expect(ConflictEvent.create).not.toHaveBeenCalled();
    });
  });

  // ====================================
  // 2. Zone Violation Check
  // ====================================
  describe("Zone Violation Check", () => {
    it("should create alert when drone enters no-fly zone", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100);

      FlightSession.find = jest.fn().mockResolvedValue([]); // No proximity issues
      Zone.find = jest.fn().mockResolvedValue([
        {
          _id: "zone1",
          name: "Military Zone A",
          type: "no_fly",
          minAltitude: 0,
          maxAltitude: 500,
          effectiveFrom: new Date("2020-01-01"),
          effectiveTo: new Date("2030-12-31"),
        },
      ]);

      await runInflightChecks(session, telemetry);

      expect(createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "ZONE_VIOLATION",
          severity: "CRITICAL",
          data: expect.objectContaining({
            zoneId: "zone1",
            zoneType: "no_fly",
          }),
        }),
      );
    });

    it("should skip zone if altitude is outside zone range", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 600); // Above zone

      FlightSession.find = jest.fn().mockResolvedValue([]);
      Zone.find = jest.fn().mockResolvedValue([
        {
          _id: "zone1",
          name: "Low Zone",
          type: "restricted",
          minAltitude: 0,
          maxAltitude: 300, // Drone at 600m, zone max 300m
        },
      ]);

      await runInflightChecks(session, telemetry);

      // Alert should NOT be created for zone violation (altitude outside)
      const zoneCalls = createAlert.mock.calls.filter(
        (c) => c[0].type === "ZONE_VIOLATION",
      );
      expect(zoneCalls).toHaveLength(0);
    });
  });

  // ====================================
  // 3. Deviation Check (PLANNED only)
  // ====================================
  describe("Deviation Check", () => {
    it("should create alert when drone deviates from planned route", async () => {
      const session = makeSession({ sessionType: "PLANNED" });
      // Drone at 10.83, 106.64 but plan expects it at 10.82, 106.63
      const telemetry = makeTelemetry(10.83, 106.64, 100);

      FlightSession.find = jest.fn().mockResolvedValue([]);
      Zone.find = jest.fn().mockResolvedValue([]);

      // Mock FlightPlan with waypoints
      const now = new Date();
      FlightPlan.findById = jest.fn().mockResolvedValue({
        _id: "plan1",
        waypoints: [
          {
            latitude: 10.82,
            longitude: 106.63,
            altitude: 100,
            estimatedTime: new Date(now.getTime() - 60000), // 1 min ago
          },
          {
            latitude: 10.82,
            longitude: 106.63,
            altitude: 100,
            estimatedTime: new Date(now.getTime() + 60000), // 1 min from now
          },
        ],
      });

      await runInflightChecks(session, telemetry);

      const deviationCalls = createAlert.mock.calls.filter(
        (c) => c[0].type === "DEVIATION",
      );
      expect(deviationCalls.length).toBeGreaterThan(0);
      expect(deviationCalls[0][0]).toMatchObject({
        type: "DEVIATION",
        data: expect.objectContaining({
          deviationDistance: expect.any(Number),
        }),
      });
    });

    it("should SKIP deviation check for FREE_FLIGHT sessions", async () => {
      const session = makeSession({
        sessionType: "FREE_FLIGHT",
        flightPlan: null,
      });
      const telemetry = makeTelemetry(10.83, 106.64, 100);

      FlightSession.find = jest.fn().mockResolvedValue([]);
      Zone.find = jest.fn().mockResolvedValue([]);

      await runInflightChecks(session, telemetry);

      // FlightPlan.findById should NOT be called for FREE_FLIGHT
      expect(FlightPlan.findById).not.toHaveBeenCalled();
    });
  });

  // ====================================
  // 4. Battery Check
  // ====================================
  describe("Battery Check", () => {
    it("should create alert when battery is below threshold", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100, 15); // 15% battery

      FlightSession.find = jest.fn().mockResolvedValue([]);
      Zone.find = jest.fn().mockResolvedValue([]);

      await runInflightChecks(session, telemetry);

      expect(createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "BATTERY_LOW",
          severity: "HIGH",
          data: expect.objectContaining({
            batteryLevel: 15,
            threshold: 20,
          }),
        }),
      );
    });

    it("should create CRITICAL alert when battery is very low", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100, 5); // 5% battery

      FlightSession.find = jest.fn().mockResolvedValue([]);
      Zone.find = jest.fn().mockResolvedValue([]);

      await runInflightChecks(session, telemetry);

      expect(createAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "BATTERY_LOW",
          severity: "CRITICAL",
        }),
      );
    });

    it("should NOT alert when battery is healthy", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100, 85); // 85% battery

      FlightSession.find = jest.fn().mockResolvedValue([]);
      Zone.find = jest.fn().mockResolvedValue([]);

      await runInflightChecks(session, telemetry);

      const batteryCalls = createAlert.mock.calls.filter(
        (c) => c[0].type === "BATTERY_LOW",
      );
      expect(batteryCalls).toHaveLength(0);
    });

    it("should skip battery check when batteryLevel is null", async () => {
      const session = makeSession();
      const telemetry = makeTelemetry(10.8231, 106.6297, 100);
      telemetry.batteryLevel = null;

      FlightSession.find = jest.fn().mockResolvedValue([]);
      Zone.find = jest.fn().mockResolvedValue([]);

      await runInflightChecks(session, telemetry);

      const batteryCalls = createAlert.mock.calls.filter(
        (c) => c[0].type === "BATTERY_LOW",
      );
      expect(batteryCalls).toHaveLength(0);
    });
  });
});
