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
              type: 'object',
              properties: {
                _id: {
                  type: 'string',
                  example: '507f1f77bcf86cd799439011',
                },
                email: {
                  type: 'string',
                  example: 'user@example.com',
                },
                profile: {
                  type: 'object',
                  properties: {
                    fullName: {
                      type: 'string',
                      example: 'John Doe',
                    },
                    avatar: {
                      type: 'string',
                      example: 'https://example.com/avatar.jpg',
                    },
                  },
                },
                role: {
                  type: 'string',
                  enum: ['user', 'admin'],
                  example: 'user',
                },
                status: {
                  type: 'string',
                  enum: ['active', 'inactive', 'banned'],
                  example: 'active',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                updatedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
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
