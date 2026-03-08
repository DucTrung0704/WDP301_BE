/**
 * Unit test cho các helper functions trong conflictDetection.service.js
 * Chạy: npx jest src/modules/conflict/__tests__/conflictDetection.test.js
 */

const {
  haversineDistance,
  interpolatePosition,
  getOverlappingTimeWindow,
  pointToCell,
  determineSeverity,
  pairwiseConflictCheck,
  segmentationConflictCheck,
} = require("../conflictDetection.service");

// ============================================================
// Helper Function Tests
// ============================================================

describe("haversineDistance", () => {
  test("same point returns 0", () => {
    expect(haversineDistance(10, 106, 10, 106)).toBeCloseTo(0, 0);
  });

  test("known distance HCM to Hanoi (~1140km)", () => {
    const dist = haversineDistance(10.8231, 106.6297, 21.0285, 105.8542);
    expect(dist).toBeGreaterThan(1100000);
    expect(dist).toBeLessThan(1200000);
  });

  test("short distance (~111m for 0.001 degree lat)", () => {
    const dist = haversineDistance(10.0, 106.0, 10.001, 106.0);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });
});

describe("interpolatePosition", () => {
  const waypoints = [
    {
      latitude: 10,
      longitude: 106,
      altitude: 100,
      estimatedTime: new Date("2026-01-01T10:00:00Z"),
    },
    {
      latitude: 11,
      longitude: 107,
      altitude: 200,
      estimatedTime: new Date("2026-01-01T11:00:00Z"),
    },
  ];

  test("returns start position at start time", () => {
    const pos = interpolatePosition(
      waypoints,
      new Date("2026-01-01T10:00:00Z"),
    );
    expect(pos.latitude).toBeCloseTo(10);
    expect(pos.longitude).toBeCloseTo(106);
    expect(pos.altitude).toBeCloseTo(100);
  });

  test("returns end position at end time", () => {
    const pos = interpolatePosition(
      waypoints,
      new Date("2026-01-01T11:00:00Z"),
    );
    expect(pos.latitude).toBeCloseTo(11);
    expect(pos.longitude).toBeCloseTo(107);
    expect(pos.altitude).toBeCloseTo(200);
  });

  test("returns midpoint at midtime", () => {
    const pos = interpolatePosition(
      waypoints,
      new Date("2026-01-01T10:30:00Z"),
    );
    expect(pos.latitude).toBeCloseTo(10.5);
    expect(pos.longitude).toBeCloseTo(106.5);
    expect(pos.altitude).toBeCloseTo(150);
  });

  test("returns null before start time", () => {
    const pos = interpolatePosition(
      waypoints,
      new Date("2026-01-01T09:00:00Z"),
    );
    expect(pos).toBeNull();
  });

  test("returns null after end time", () => {
    const pos = interpolatePosition(
      waypoints,
      new Date("2026-01-01T12:00:00Z"),
    );
    expect(pos).toBeNull();
  });
});

describe("getOverlappingTimeWindow", () => {
  test("full overlap returns correct window", () => {
    const plan1 = {
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T12:00:00Z",
    };
    const plan2 = {
      plannedStart: "2026-01-01T11:00:00Z",
      plannedEnd: "2026-01-01T13:00:00Z",
    };
    const overlap = getOverlappingTimeWindow(plan1, plan2);
    expect(overlap).not.toBeNull();
    expect(overlap.start).toBe(new Date("2026-01-01T11:00:00Z").getTime());
    expect(overlap.end).toBe(new Date("2026-01-01T12:00:00Z").getTime());
  });

  test("no overlap returns null", () => {
    const plan1 = {
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T11:00:00Z",
    };
    const plan2 = {
      plannedStart: "2026-01-01T12:00:00Z",
      plannedEnd: "2026-01-01T13:00:00Z",
    };
    expect(getOverlappingTimeWindow(plan1, plan2)).toBeNull();
  });

  test("adjacent periods (end == start) returns null", () => {
    const plan1 = {
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T11:00:00Z",
    };
    const plan2 = {
      plannedStart: "2026-01-01T11:00:00Z",
      plannedEnd: "2026-01-01T12:00:00Z",
    };
    expect(getOverlappingTimeWindow(plan1, plan2)).toBeNull();
  });
});

describe("pointToCell", () => {
  const gridConfig = { CELL_SIZE_X: 200, CELL_SIZE_Y: 200, CELL_SIZE_Z: 50 };

  test("same point returns same cell", () => {
    const cell1 = pointToCell(10.0, 106.0, 100, gridConfig);
    const cell2 = pointToCell(10.0, 106.0, 100, gridConfig);
    expect(cell1).toBe(cell2);
  });

  test("different altitudes may return different cells", () => {
    const cell1 = pointToCell(10.0, 106.0, 100, gridConfig);
    const cell2 = pointToCell(10.0, 106.0, 200, gridConfig);
    expect(cell1).not.toBe(cell2);
  });
});

describe("determineSeverity", () => {
  test("very close → CRITICAL", () => {
    expect(determineSeverity(10, 5)).toBe("CRITICAL");
  });

  test("medium distance → MEDIUM", () => {
    expect(determineSeverity(80, 25)).toBe("MEDIUM");
  });
});

// ============================================================
// Algorithm Tests (with mock _id)
// ============================================================

describe("pairwiseConflictCheck", () => {
  const makeId = (str) => ({ toString: () => str });

  test("detects conflict when two plans overlap spatially and temporally", () => {
    const plan1 = {
      _id: makeId("plan1"),
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T11:00:00Z",
      waypoints: [
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T10:00:00Z"),
        },
        {
          latitude: 10.0005,
          longitude: 106.0005,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T11:00:00Z"),
        },
      ],
    };

    const plan2 = {
      _id: makeId("plan2"),
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T11:00:00Z",
      waypoints: [
        {
          latitude: 10.0003,
          longitude: 106.0003,
          altitude: 105,
          estimatedTime: new Date("2026-01-01T10:00:00Z"),
        },
        {
          latitude: 10.0002,
          longitude: 106.0002,
          altitude: 105,
          estimatedTime: new Date("2026-01-01T11:00:00Z"),
        },
      ],
    };

    const conflicts = pairwiseConflictCheck(plan1, [plan2]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].detectionMethod).toBe("PAIRWISE");
  });

  test("no conflict when plans are far apart", () => {
    const plan1 = {
      _id: makeId("plan1"),
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T11:00:00Z",
      waypoints: [
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T10:00:00Z"),
        },
        {
          latitude: 10.1,
          longitude: 106.1,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T11:00:00Z"),
        },
      ],
    };

    const plan2 = {
      _id: makeId("plan2"),
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T11:00:00Z",
      waypoints: [
        {
          latitude: 11.0,
          longitude: 107.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T10:00:00Z"),
        },
        {
          latitude: 11.1,
          longitude: 107.1,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T11:00:00Z"),
        },
      ],
    };

    const conflicts = pairwiseConflictCheck(plan1, [plan2]);
    expect(conflicts.length).toBe(0);
  });

  test("no conflict when plans have different time windows", () => {
    const plan1 = {
      _id: makeId("plan1"),
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T11:00:00Z",
      waypoints: [
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T10:00:00Z"),
        },
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T11:00:00Z"),
        },
      ],
    };

    const plan2 = {
      _id: makeId("plan2"),
      plannedStart: "2026-01-01T14:00:00Z",
      plannedEnd: "2026-01-01T15:00:00Z",
      waypoints: [
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T14:00:00Z"),
        },
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T15:00:00Z"),
        },
      ],
    };

    const conflicts = pairwiseConflictCheck(plan1, [plan2]);
    expect(conflicts.length).toBe(0);
  });
});

describe("segmentationConflictCheck", () => {
  const makeId = (str) => ({ toString: () => str });

  test("detects conflict when plans share same cell and time slot", () => {
    const plan1 = {
      _id: makeId("plan1"),
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T10:10:00Z",
      waypoints: [
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T10:00:00Z"),
        },
        {
          latitude: 10.0001,
          longitude: 106.0001,
          altitude: 100,
          estimatedTime: new Date("2026-01-01T10:10:00Z"),
        },
      ],
    };

    const plan2 = {
      _id: makeId("plan2"),
      plannedStart: "2026-01-01T10:00:00Z",
      plannedEnd: "2026-01-01T10:10:00Z",
      waypoints: [
        {
          latitude: 10.0001,
          longitude: 106.0001,
          altitude: 110,
          estimatedTime: new Date("2026-01-01T10:00:00Z"),
        },
        {
          latitude: 10.0,
          longitude: 106.0,
          altitude: 110,
          estimatedTime: new Date("2026-01-01T10:10:00Z"),
        },
      ],
    };

    const conflicts = segmentationConflictCheck(plan1, [plan2]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].detectionMethod).toBe("SEGMENTATION");
  });
});
