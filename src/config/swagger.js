'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const bearerAuthScheme = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
};

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

/**
 * Definición base de OpenAPI 3.0.3. Los `paths` se generan a partir de las
 * anotaciones `@openapi` (JSDoc) presentes en los archivos de rutas.
 *
 * @type {import('swagger-jsdoc').Options['definition']}
 */
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Tienda API',
    version: '1.0.0',
    description:
      'API de gestión de usuarios, productos y autenticación. Documentación generada con swagger-jsdoc.',
  },
  servers: [{ url: `http://localhost:${process.env.PORT || 3000}` }],
  components: {
    securitySchemes: {
      bearerAuth: bearerAuthScheme,
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'pedro@ejemplo.cl' },
          password: { type: 'string', example: '321321' },
        },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              access_token: { type: 'string' },
              refresh_token: { type: 'string' },
            },
          },
        },
      },
      UserInput: {
        type: 'object',
        required: ['username', 'nombre', 'apellido', 'rol', 'email', 'password'],
        properties: {
          username: { type: 'string', maxLength: 20, example: 'pedro' },
          nombre: { type: 'string', maxLength: 20, example: 'Pedro' },
          apellido: { type: 'string', maxLength: 20, example: 'Perez' },
          rol: { type: 'string', enum: ['admin', 'supervisor', 'invitado'] },
          email: { type: 'string', format: 'email', example: 'pedro@ejemplo.cl' },
          password: { type: 'string', minLength: 6, example: '321321' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          username: { type: 'string' },
          nombre: { type: 'string' },
          apellido: { type: 'string' },
          rol: { type: 'string', enum: ['admin', 'supervisor', 'invitado'] },
          email: { type: 'string', format: 'email' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ProductoInput: {
        type: 'object',
        required: ['asin', 'currency', 'product_price', 'product_title'],
        properties: {
          asin: { type: 'string', example: 'B0CP6DDN1H' },
          currency: { type: 'string', example: 'USD' },
          product_price: { type: 'number', example: 94.99 },
          product_title: { type: 'string' },
          product_photo: { type: 'string', format: 'binary' },
          product_badge: { type: 'string' },
          product_url: { type: 'string' },
          delivery: { type: 'string' },
          sales_volume: { type: 'string' },
          climate_pledge_friendly: { type: 'boolean' },
          has_variations: { type: 'boolean' },
          is_amazon_choice: { type: 'boolean' },
          is_best_seller: { type: 'boolean' },
          is_prime: { type: 'boolean' },
          product_minimum_offer_price: { type: 'number' },
          product_num_offers: { type: 'integer' },
          product_num_ratings: { type: 'integer' },
          product_original_price: { type: 'number' },
          product_star_rating: { type: 'number' },
        },
      },
      Producto: {
        type: 'object',
        properties: {
          asin: { type: 'string' },
          currency: { type: 'string' },
          product_price: { type: 'number' },
          product_title: { type: 'string' },
          product_photo: { type: 'string' },
        },
      },
      ProductoList: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'success' },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Producto' },
          },
          totProd: { type: 'integer', example: 42, description: 'Total de productos encontrados' },
          page: { type: 'integer', example: 1, description: 'Página actual o solicitada' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          statusCode: { type: 'integer', example: 400 },
          message: { type: 'string' },
          code: { type: 'string' },
        },
      },
    },
    responses: {
      BadRequest: { ...errorResponse, description: 'Solicitud inválida (400)' },
      Unauthorized: { ...errorResponse, description: 'No autenticado (401)' },
      Forbidden: { ...errorResponse, description: 'Sin permisos (403)' },
      NotFound: { ...errorResponse, description: 'Recurso no encontrado (404)' },
      Conflict: { ...errorResponse, description: 'Conflicto (409)' },
    },
  },
};

const options = {
  definition,
  apis: ['./src/routes/*.js'],
};

/**
 * Genera la especificación OpenAPI a partir de la definición y las anotaciones.
 *
 * @returns {object} Documento OpenAPI listo para serializar.
 */
function buildSpec() {
  return swaggerJsdoc(options);
}

/**
 * Monta la interfaz de Swagger y el endpoint JSON de la especificación.
 *
 * @param {import('express').Express} app Instancia de Express.
 * @returns {void}
 */
function setupSwagger(app) {
  const spec = buildSpec();
  app.get('/api/docs.json', (req, res) => res.json(spec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
}

module.exports = { setupSwagger, buildSpec, definition };
