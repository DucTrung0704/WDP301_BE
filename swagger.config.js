// swagger.config.js
const swaggerJSDoc = require('swagger-jsdoc');

//link swaggerdocs: http://localhost:5000/api-docs/

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WDP301 API Documentation',
      version: '1.0.0',
      description: 'API documentation for WDP301 Backend - Authentication APIs',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://wdp-301-be-mauve.vercel.app',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            email: { type: 'string', example: 'user@example.com' },
            profile: {
              type: 'object',
              properties: {
                fullName: { type: 'string', example: 'John Doe' },
                avatar: { type: 'string', example: 'https://example.com/avatar.jpg' },
              },
            },
            role: {
              type: 'string',
              enum: ['UTM_ADMIN', 'INDIVIDUAL_OPERATOR', 'FLEET_OPERATOR'],
              example: 'INDIVIDUAL_OPERATOR',
              description: 'User role: UTM_ADMIN, INDIVIDUAL_OPERATOR, or FLEET_OPERATOR',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'banned'],
              example: 'active',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
              description: 'Email address of the user',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 6,
              example: 'password123',
              description: 'Password for the account',
            },
            fullName: {
              type: 'string',
              example: 'John Doe',
              description: 'Full name of the user (optional)',
            },
            role: {
              type: 'string',
              enum: ['INDIVIDUAL_OPERATOR', 'FLEET_OPERATOR'],
              example: 'INDIVIDUAL_OPERATOR',
              description: 'Optional. User role when self-registering (cannot be UTM_ADMIN)',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'password123',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT access token (expires in 7 days)',
            },
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT refresh token (expires in 30 days)',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Error message description',
            },
          },
        },
        Drone: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            droneId: { type: 'string', example: 'DRONE001', description: 'Unique drone identifier' },
            serialNumber: { type: 'string', example: 'SN123456' },
            model: { type: 'string', example: 'DJI Air 3' },
            owner: {
              type: 'object',
              properties: {
                _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
                email: { type: 'string', example: 'user@example.com' },
                profile: {
                  type: 'object',
                  properties: {
                    fullName: { type: 'string', example: 'John Doe' },
                  },
                },
                role: { type: 'string', example: 'INDIVIDUAL_OPERATOR' },
              },
            },
            ownerType: {
              type: 'string',
              enum: ['INDIVIDUAL', 'FLEET'],
              example: 'INDIVIDUAL',
            },
            maxAltitude: { type: 'number', example: 5000 },
            status: {
              type: 'string',
              enum: ['IDLE', 'FLYING', 'MAINTENANCE', 'DISABLED'],
              example: 'IDLE',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateDroneRequest: {
          type: 'object',
          required: ['serialNumber'],
          properties: {
            serialNumber: {
              type: 'string',
              example: 'SN123456',
              description: 'Serial number of the drone (required)',
            },
            model: {
              type: 'string',
              example: 'DJI Air 3',
              description: 'Drone model',
            },
            ownerType: {
              type: 'string',
              enum: ['INDIVIDUAL', 'FLEET'],
              example: 'INDIVIDUAL',
              description: 'Type of owner (default: INDIVIDUAL)',
            },
            maxAltitude: {
              type: 'number',
              example: 5000,
              description: 'Maximum altitude in meters',
            },
          },
        },
        UpdateDroneRequest: {
          type: 'object',
          properties: {
            serialNumber: {
              type: 'string',
              example: 'SN123456',
            },
            model: {
              type: 'string',
              example: 'DJI Air 3S',
            },
            ownerType: {
              type: 'string',
              enum: ['INDIVIDUAL', 'FLEET'],
            },
            maxAltitude: {
              type: 'number',
              example: 6000,
            },
            status: {
              type: 'string',
              enum: ['IDLE', 'FLYING', 'MAINTENANCE', 'DISABLED'],
            },
          },
        },
        DroneResponse: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            droneId: { type: 'string' },
            serialNumber: { type: 'string' },
            model: { type: 'string' },
            owner: { $ref: '#/components/schemas/User' },
            ownerType: { type: 'string' },
            maxAltitude: { type: 'number' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Flight: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439099' },
            drone: {
              $ref: '#/components/schemas/Drone',
            },
            operator: {
              $ref: '#/components/schemas/User',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-20T08:00:00Z',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-20T09:00:00Z',
            },
            origin: {
              type: 'string',
              example: 'Tan Son Nhat Airport',
            },
            destination: {
              type: 'string',
              example: 'District 1, HCMC',
            },
            status: {
              type: 'string',
              enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
              example: 'COMPLETED',
            },
            notes: {
              type: 'string',
              example: 'Routine inspection flight',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateFlightRequest: {
          type: 'object',
          required: ['droneId', 'startTime'],
          properties: {
            droneId: {
              type: 'string',
              example: '507f1f77bcf86cd799439011',
              description: 'MongoDB ObjectId of the drone',
            },
            startTime: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-20T08:00:00Z',
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              example: '2026-01-20T09:00:00Z',
            },
            origin: {
              type: 'string',
              example: 'Tan Son Nhat Airport',
            },
            destination: {
              type: 'string',
              example: 'District 1, HCMC',
            },
            status: {
              type: 'string',
              enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
              example: 'COMPLETED',
            },
            notes: {
              type: 'string',
              example: 'Routine inspection flight',
            },
          },
        },
      },
    },
  },
  apis: ['./swagger.docs.js'], // Path to Swagger documentation file
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
