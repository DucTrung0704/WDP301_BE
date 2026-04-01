/**
 * Test: Cross-Mission Drone Conflict Validation
 * 
 * Scenario: 2 plans use the same drone, assigned to different missions at the same time
 * Expected: Should throw validation error when trying to add the second plan
 */

const mongoose = require('mongoose');
const Mission = require('../mission.model');
const MissionPlan = require('../missionPlan.model');
const FlightPlan = require('../../flightPlan/flightPlan.model');
const User = require('../../../models/user.models');
const Drone = require('../../../models/drone.model');
const missionService = require('../mission.service');

describe('Cross-Mission Drone Conflict Validation', () => {
    let userId, droneId, flightPlan1Id, flightPlan2Id, mission1Id, mission2Id;
    let user, drone, flightPlan1, flightPlan2;

    beforeAll(async () => {
        // Setup: Create test user
        user = await User.create({
            email: 'test@example.com',
            role: 'PILOT',
        });
        userId = user._id;

        // Setup: Create test drone
        drone = await Drone.create({
            registrationNumber: 'DRONE-TEST-001',
            model: 'DJI-Phantom4',
            owner: userId,
        });
        droneId = drone._id;

        // Setup: Create 2 flight plans with the same drone
        flightPlan1 = await FlightPlan.create({
            name: 'Plan 1 - Same Drone',
            pilot: userId,
            drone: droneId,
            status: 'ACTIVE',
            waypoints: [],
            routeGeometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        });
        flightPlan1Id = flightPlan1._id;

        flightPlan2 = await FlightPlan.create({
            name: 'Plan 2 - Same Drone',
            pilot: userId,
            drone: droneId,
            status: 'ACTIVE',
            waypoints: [],
            routeGeometry: { type: 'LineString', coordinates: [[2, 2], [3, 3]] },
        });
        flightPlan2Id = flightPlan2._id;
    });

    afterAll(async () => {
        await User.deleteMany({});
        await Drone.deleteMany({});
        await FlightPlan.deleteMany({});
        await Mission.deleteMany({});
        await MissionPlan.deleteMany({});
    });

    test('Should successfully add plan to mission 1', async () => {
        // Create mission 1
        const mission1 = await missionService.createMission(
            { name: 'Mission 1', description: 'Test mission 1' },
            userId,
        );
        mission1Id = mission1._id;

        // Add plan 1 to mission 1 at time 10:00-11:00
        const result = await missionService.addPlanToMission(
            mission1Id,
            {
                flightPlanId: flightPlan1Id,
                plannedStart: new Date('2024-01-15T10:00:00Z'),
                plannedEnd: new Date('2024-01-15T11:00:00Z'),
            },
            userId,
            'PILOT',
        );

        expect(result).toBeDefined();
        expect(result.flightPlan._id.toString()).toBe(flightPlan1Id.toString());
    });

    test('Should fail to add same drone to mission 2 at overlapping time', async () => {
        // Create mission 2
        const mission2 = await missionService.createMission(
            { name: 'Mission 2', description: 'Test mission 2' },
            userId,
        );
        mission2Id = mission2._id;

        // Try to add plan 2 (same drone) to mission 2 at overlapping time (10:30-11:30)
        // Should fail because drone is already in mission 1 (10:00-11:00)
        
        await expect(
            missionService.addPlanToMission(
                mission2Id,
                {
                    flightPlanId: flightPlan2Id,
                    plannedStart: new Date('2024-01-15T10:30:00Z'),
                    plannedEnd: new Date('2024-01-15T11:30:00Z'),
                },
                userId,
                'PILOT',
            ),
        ).rejects.toThrow(/Drone is already scheduled in another mission/);
    });

    test('Should allow adding same drone to mission 2 at non-overlapping time', async () => {
        // Get mission 2 (created in previous test)
        
        // Try to add plan 2 (same drone) to mission 2 at non-overlapping time (12:00-13:00)
        // Should succeed because drone is free at this time
        
        const result = await missionService.addPlanToMission(
            mission2Id,
            {
                flightPlanId: flightPlan2Id,
                plannedStart: new Date('2024-01-15T12:00:00Z'),
                plannedEnd: new Date('2024-01-15T13:00:00Z'),
            },
            userId,
            'PILOT',
        );

        expect(result).toBeDefined();
        expect(result.flightPlan._id.toString()).toBe(flightPlan2Id.toString());
    });

    test('Should validate updateMissionPlan for cross-mission drone conflicts', async () => {
        // Get the mission plan we created in mission 2
        const missionPlans = await MissionPlan.find({ mission: mission2Id });
        const missionPlanToUpdate = missionPlans[0];

        // Try to update it to overlap with mission 1's time (should fail)
        await expect(
            missionService.updateMissionPlan(
                mission2Id,
                missionPlanToUpdate._id,
                {
                    plannedStart: new Date('2024-01-15T10:30:00Z'),
                    plannedEnd: new Date('2024-01-15T11:30:00Z'),
                },
                userId,
                'PILOT',
            ),
        ).rejects.toThrow(/Drone is already scheduled in another mission/);
    });

    test('Should allow updateMissionPlan to non-overlapping time', async () => {
        // Get mission plan from mission 2
        const missionPlans = await MissionPlan.find({ mission: mission2Id });
        const missionPlanToUpdate = missionPlans[0];

        // Update to different non-overlapping time (should succeed)
        const result = await missionService.updateMissionPlan(
            mission2Id,
            missionPlanToUpdate._id,
            {
                plannedStart: new Date('2024-01-16T10:00:00Z'),
                plannedEnd: new Date('2024-01-16T11:00:00Z'),
            },
            userId,
            'PILOT',
        );

        expect(result).toBeDefined();
        expect(result.plannedStart.getTime()).toBe(
            new Date('2024-01-16T10:00:00Z').getTime()
        );
    });

    test('Error message should include names of conflicting missions', async () => {
        // Create a 3rd mission and try to add same drone at overlapping time
        const mission3 = await missionService.createMission(
            { name: 'Mission 3 - Conflict Check', description: 'Third mission' },
            userId,
        );

        try {
            await missionService.addPlanToMission(
                mission3._id,
                {
                    flightPlanId: flightPlan1Id,
                    plannedStart: new Date('2024-01-15T10:15:00Z'),
                    plannedEnd: new Date('2024-01-15T10:45:00Z'),
                },
                userId,
                'PILOT',
            );
            fail('Should have thrown error');
        } catch (err) {
            // Error should mention mission 1
            expect(err.message).toContain('Drone is already scheduled in another mission');
            expect(err.message).toContain('Mission 1'); // Should show conflicting mission name
        }
    });
});
