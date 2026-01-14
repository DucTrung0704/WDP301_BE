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
              description: 'JWT token for authentication',
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
      },
    },
  },
  apis: ['./swagger.docs.js'], // Path to Swagger documentation file
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
