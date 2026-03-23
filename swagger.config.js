// swagger.config.js
const swaggerJSDoc = require("swagger-jsdoc");

//link swaggerdocs: http://localhost:5000/api-docs/

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WDP301 API Documentation",
      version: "1.0.0",
      description: "API documentation for WDP301 Backend - Authentication APIs",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server",
      },
      {
        url: "https://wdp-a0c3gxa5f6c9gjg6.japaneast-01.azurewebsites.net",
        description: "Azure server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "507f1f77bcf86cd799439011" },
            email: { type: "string", example: "user@example.com" },
            profile: {
              type: "object",
              properties: {
                fullName: { type: "string", example: "John Doe" },
                avatar: {
                  type: "string",
                  example: "https://example.com/avatar.jpg",
                },
              },
            },
            role: {
              type: "string",
              enum: ["UTM_ADMIN", "INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"],
              example: "INDIVIDUAL_OPERATOR",
              description:
                "User role: UTM_ADMIN, INDIVIDUAL_OPERATOR, or FLEET_OPERATOR",
            },
            status: {
              type: "string",
              enum: ["active", "inactive", "banned"],
              example: "active",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
              description: "Email address of the user",
            },
            password: {
              type: "string",
              format: "password",
              minLength: 6,
              example: "password123",
              description: "Password for the account",
            },
            fullName: {
              type: "string",
              example: "John Doe",
              description: "Full name of the user (optional)",
            },
            role: {
              type: "string",
              enum: ["INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"],
              example: "INDIVIDUAL_OPERATOR",
              description:
                "Optional. User role when self-registering (cannot be UTM_ADMIN)",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "user@example.com",
            },
            password: {
              type: "string",
              format: "password",
              example: "password123",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              description: "JWT access token (expires in 7 days)",
            },
            refreshToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              description: "JWT refresh token (expires in 30 days)",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Error message description",
            },
          },
        },
        Drone: {
          type: "object",
          properties: {
            _id: { type: "string", example: "507f1f77bcf86cd799439011" },
            droneId: {
              type: "string",
              example: "DRONE001",
              description: "Unique drone identifier",
            },
            serialNumber: { type: "string", example: "SN123456" },
            model: { type: "string", example: "DJI Air 3" },
            owner: {
              type: "object",
              properties: {
                _id: { type: "string", example: "507f1f77bcf86cd799439011" },
                email: { type: "string", example: "user@example.com" },
                profile: {
                  type: "object",
                  properties: {
                    fullName: { type: "string", example: "John Doe" },
                  },
                },
                role: { type: "string", example: "INDIVIDUAL_OPERATOR" },
              },
            },
            ownerType: {
              type: "string",
              enum: ["INDIVIDUAL", "FLEET"],
              example: "INDIVIDUAL",
            },
            maxAltitude: { type: "number", example: 5000 },
            status: {
              type: "string",
              enum: ["IDLE", "FLYING", "MAINTENANCE", "DISABLED"],
              example: "IDLE",
            },
            route: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["LineString"], example: "LineString" },
                coordinates: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "number" },
                  },
                  example: [
                    [106.6297, 10.8231],
                    [106.6400, 10.8300],
                    [106.6450, 10.8350],
                  ],
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateDroneRequest: {
          type: "object",
          required: ["serialNumber"],
          properties: {
            serialNumber: {
              type: "string",
              example: "SN123456",
              description: "Serial number of the drone (required)",
            },
            model: {
              type: "string",
              example: "DJI Air 3",
              description: "Drone model",
            },
            ownerType: {
              type: "string",
              enum: ["INDIVIDUAL", "FLEET"],
              example: "INDIVIDUAL",
              description: "Type of owner (default: INDIVIDUAL)",
            },
            maxAltitude: {
              type: "number",
              example: 5000,
              description: "Maximum altitude in meters",
            },
            route: {
              type: "object",
              description: "Optional planned path as GeoJSON LineString",
              properties: {
                type: { type: "string", enum: ["LineString"], example: "LineString" },
                coordinates: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "number" },
                  },
                },
              },
            },
          },
        },
        UpdateDroneRequest: {
          type: "object",
          properties: {
            serialNumber: {
              type: "string",
              example: "SN123456",
            },
            model: {
              type: "string",
              example: "DJI Air 3S",
            },
            ownerType: {
              type: "string",
              enum: ["INDIVIDUAL", "FLEET"],
            },
            maxAltitude: {
              type: "number",
              example: 6000,
            },
            status: {
              type: "string",
              enum: ["IDLE", "FLYING", "MAINTENANCE", "DISABLED"],
            },
            route: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["LineString"] },
                coordinates: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "number" },
                  },
                },
              },
            },
          },
        },
        DroneResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            droneId: { type: "string" },
            serialNumber: { type: "string" },
            model: { type: "string" },
            owner: { $ref: "#/components/schemas/User" },
            ownerType: { type: "string" },
            maxAltitude: { type: "number" },
            status: { type: "string" },
            route: {
              type: "object",
              properties: {
                type: { type: "string", example: "LineString" },
                coordinates: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "number" },
                  },
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Flight: {
          type: "object",
          properties: {
            _id: { type: "string", example: "507f1f77bcf86cd799439099" },
            drone: {
              $ref: "#/components/schemas/Drone",
            },
            operator: {
              $ref: "#/components/schemas/User",
            },
            startTime: {
              type: "string",
              format: "date-time",
              example: "2026-01-20T08:00:00Z",
            },
            endTime: {
              type: "string",
              format: "date-time",
              example: "2026-01-20T09:00:00Z",
            },
            origin: {
              type: "string",
              example: "Tan Son Nhat Airport",
            },
            destination: {
              type: "string",
              example: "District 1, HCMC",
            },
            status: {
              type: "string",
              enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
              example: "COMPLETED",
            },
            notes: {
              type: "string",
              example: "Routine inspection flight",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateFlightRequest: {
          type: "object",
          required: ["droneId", "startTime"],
          properties: {
            droneId: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
              description: "MongoDB ObjectId of the drone",
            },
            startTime: {
              type: "string",
              format: "date-time",
              example: "2026-01-20T08:00:00Z",
            },
            endTime: {
              type: "string",
              format: "date-time",
              example: "2026-01-20T09:00:00Z",
            },
            origin: {
              type: "string",
              example: "Tan Son Nhat Airport",
            },
            destination: {
              type: "string",
              example: "District 1, HCMC",
            },
            status: {
              type: "string",
              enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
              example: "COMPLETED",
            },
            notes: {
              type: "string",
              example: "Routine inspection flight",
            },
          },
        },
        Waypoint: {
          type: "object",
          required: ["sequenceNumber", "latitude", "longitude", "altitude"],
          properties: {
            sequenceNumber: {
              type: "integer",
              minimum: 1,
              example: 1,
              description: "Must be unique and continuous from 1..N",
            },
            latitude: {
              type: "number",
              minimum: -90,
              maximum: 90,
              example: 10.8231,
            },
            longitude: {
              type: "number",
              minimum: -180,
              maximum: 180,
              example: 106.6297,
            },
            altitude: {
              type: "number",
              minimum: 0,
              example: 100,
              description: "Altitude in meters",
            },
            speed: {
              type: "number",
              minimum: 0,
              example: 10,
              description: "Speed in m/s",
            },
            estimatedTime: {
              type: "string",
              format: "date-time",
              example: "2026-01-20T08:00:00Z",
              description:
                "Optional. Suggested ETA for visualization/planning only.",
            },
            action: {
              type: "string",
              enum: ["TAKEOFF", "WAYPOINT", "HOVER", "LAND"],
              example: "WAYPOINT",
            },
          },
        },
        CreateFlightPlanRequest: {
          type: "object",
          required: ["drone", "waypoints"],
          description:
            "Route template only (no schedule time). Schedule is managed in MissionPlan.",
          properties: {
            drone: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
              description: "ObjectId of the drone",
            },
            priority: {
              type: "integer",
              minimum: 1,
              maximum: 10,
              default: 1,
              example: 1,
            },
            waypoints: {
              type: "array",
              minItems: 2,
              maxItems: 500,
              items: { $ref: "#/components/schemas/Waypoint" },
            },
            notes: {
              type: "string",
              example: "Routine inspection flight plan",
            },
          },
        },
        UpdateFlightPlanRequest: {
          type: "object",
          description:
            "Partial update for route template fields. No plan-level time fields.",
          properties: {
            drone: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
              description: "ObjectId of the drone",
            },
            priority: {
              type: "integer",
              minimum: 1,
              maximum: 10,
              example: 1,
            },
            waypoints: {
              type: "array",
              minItems: 2,
              maxItems: 500,
              items: { $ref: "#/components/schemas/Waypoint" },
            },
            notes: {
              type: "string",
              example: "Updated route due to temporary restriction",
            },
          },
        },
        FlightPlanResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            drone: { $ref: "#/components/schemas/Drone" },
            pilot: { $ref: "#/components/schemas/User" },
            status: {
              type: "string",
              enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"],
            },
            priority: { type: "integer" },
            waypoints: {
              type: "array",
              items: { $ref: "#/components/schemas/Waypoint" },
            },
            routeGeometry: {
              type: "object",
              properties: {
                type: { type: "string", example: "LineString" },
                coordinates: {
                  type: "array",
                  items: { type: "array", items: { type: "number" } },
                },
              },
            },
            conflictStatus: {
              type: "string",
              enum: ["CLEAR", "CONFLICT_DETECTED", "RESOLVED"],
            },
            notes: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        MissionResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            name: { type: "string", example: "Morning Fleet Run" },
            description: { type: "string", example: "Mission for urban delivery routes" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"] },
            createdBy: { $ref: "#/components/schemas/User" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateMissionRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Morning Fleet Run" },
            description: { type: "string", example: "Mission for urban delivery routes" },
            status: { type: "string", enum: ["DRAFT", "ACTIVE", "ARCHIVED"], example: "DRAFT" },
          },
        },
        MissionPlanResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            mission: { type: "string" },
            flightPlan: { $ref: "#/components/schemas/FlightPlanResponse" },
            plannedStart: { type: "string", format: "date-time" },
            plannedEnd: { type: "string", format: "date-time" },
            order: { type: "integer", example: 1 },
            status: { type: "string", enum: ["SCHEDULED", "CANCELLED"] },
            notes: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateMissionPlanRequest: {
          type: "object",
          required: ["flightPlanId", "plannedStart", "plannedEnd"],
          properties: {
            flightPlanId: { type: "string", example: "507f1f77bcf86cd799439011" },
            plannedStart: { type: "string", format: "date-time", example: "2026-03-17T01:00:00Z" },
            plannedEnd: { type: "string", format: "date-time", example: "2026-03-17T02:00:00Z" },
            order: { type: "integer", minimum: 1, example: 1 },
            notes: { type: "string", example: "Run this route first" },
          },
        },
        ConflictEventResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            flightPlans: { type: "array", items: { type: "string" } },
            detectedAt: { type: "string", format: "date-time" },
            predictedCollisionTime: { type: "string", format: "date-time" },
            severity: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            },
            location: {
              type: "object",
              properties: {
                type: { type: "string", example: "Point" },
                coordinates: {
                  type: "array",
                  items: { type: "number" },
                  example: [106.6297, 10.8231],
                },
              },
            },
            altitude: { type: "number" },
            detectionMethod: {
              type: "string",
              enum: ["PAIRWISE", "SEGMENTATION", "ZONE_VIOLATION"],
            },
            horizontalDistance: { type: "number", description: "meters" },
            verticalDistance: { type: "number", description: "meters" },
            status: {
              type: "string",
              enum: ["ACTIVE", "RESOLVED", "DISMISSED"],
            },
            resolution: { type: "string" },
            violatedZone: {
              type: "string",
              description: "ObjectId of violated Zone (for ZONE_VIOLATION)",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        SubmitFlightPlanResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Flight plan approved — no conflicts detected",
            },
            flightPlan: { $ref: "#/components/schemas/FlightPlanResponse" },
            conflicts: {
              type: "array",
              items: { $ref: "#/components/schemas/ConflictEventResponse" },
            },
            approved: { type: "boolean", example: true },
          },
        },
        FlightSessionResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            flightPlan: { $ref: "#/components/schemas/FlightPlanResponse" },
            drone: { $ref: "#/components/schemas/Drone" },
            pilot: { $ref: "#/components/schemas/User" },
            sessionType: {
              type: "string",
              enum: ["PLANNED", "FREE_FLIGHT"],
            },
            status: {
              type: "string",
              enum: [
                "STARTING",
                "IN_PROGRESS",
                "COMPLETED",
                "ABORTED",
                "EMERGENCY_LANDED",
              ],
            },
            actualStart: { type: "string", format: "date-time" },
            actualEnd: { type: "string", format: "date-time" },
            actualRoute: {
              type: "object",
              properties: {
                type: { type: "string", example: "LineString" },
                coordinates: {
                  type: "array",
                  items: {
                    type: "array",
                    items: { type: "number" },
                  },
                },
              },
            },
            notes: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        AlertResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            flightSession: { type: "string" },
            drone: { $ref: "#/components/schemas/Drone" },
            type: {
              type: "string",
              enum: [
                "CONFLICT",
                "ZONE_VIOLATION",
                "DEVIATION",
                "BATTERY_LOW",
                "CONNECTION_LOST",
              ],
            },
            severity: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            },
            message: { type: "string" },
            location: {
              type: "object",
              properties: {
                type: { type: "string", example: "Point" },
                coordinates: {
                  type: "array",
                  items: { type: "number" },
                  example: [106.6297, 10.8231],
                },
              },
            },
            altitude: { type: "number" },
            data: {
              type: "object",
              description:
                "Chi tiết bổ sung tùy loại alert (conflictEventId, zoneId, deviationDistance, batteryLevel, etc.)",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        TelemetryResponse: {
          type: "object",
          properties: {
            _id: { type: "string" },
            drone: { type: "string" },
            flightSession: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            location: {
              type: "object",
              properties: {
                type: { type: "string", example: "Point" },
                coordinates: {
                  type: "array",
                  items: { type: "number" },
                  example: [106.6297, 10.8231],
                },
              },
            },
            altitude: { type: "number", example: 100 },
            speed: { type: "number", example: 15 },
            heading: { type: "number", example: 180 },
            batteryLevel: { type: "number", example: 85 },
          },
        },
      },
    },
  },
  apis: ["./swagger.docs.js"], // Path to Swagger documentation file
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
