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
        url: "https://wdp-301-be-mauve.vercel.app",
        description: "Development server",
      },
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
          required: [
            "sequenceNumber",
            "latitude",
            "longitude",
            "altitude",
            "estimatedTime",
          ],
          properties: {
            sequenceNumber: { type: "integer", example: 1 },
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
          required: ["drone", "plannedStart", "plannedEnd", "waypoints"],
          properties: {
            drone: {
              type: "string",
              example: "507f1f77bcf86cd799439011",
              description: "ObjectId of the drone",
            },
            plannedStart: {
              type: "string",
              format: "date-time",
              example: "2026-01-20T08:00:00Z",
            },
            plannedEnd: {
              type: "string",
              format: "date-time",
              example: "2026-01-20T09:00:00Z",
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
              items: { $ref: "#/components/schemas/Waypoint" },
            },
            notes: {
              type: "string",
              example: "Routine inspection flight plan",
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
            plannedStart: { type: "string", format: "date-time" },
            plannedEnd: { type: "string", format: "date-time" },
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
