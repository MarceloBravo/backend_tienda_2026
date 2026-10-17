'use strict';

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const createApiRouter = require('./routes');
const errorHandler = require('./middlewares/errorHandler.middleware');
const { setupSwagger } = require('./config/swagger');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE'];
const ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

/**
 * Reúne los orígenes permitidos para CORS a partir de las variables de entorno.
 *
 * @returns {string[]} Lista de orígenes configurados.
 */
function resolveCorsOrigins() {
  return [process.env.FRONTEND_URL, process.env.FRONTEND_URL2].filter(Boolean);
}

/**
 * Crea y configura la aplicación Express (middleware global, rutas, Swagger y
 * manejo de errores) sin abrir el puerto. Separar el `listen` en `server.js`
 * permite testear con `supertest`.
 *
 * @param {object} deps Dependencias de la aplicación.
 * @param {object} deps.controllers Controladores construidos por el contenedor.
 * @param {import('./db').Database} deps.database Adaptador de base de datos.
 * @returns {import('express').Express} Aplicación Express configurada.
 */
function createApp({ controllers, database }) {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: resolveCorsOrigins(),
      credentials: true,
      methods: ALLOWED_METHODS,
      allowedHeaders: ALLOWED_HEADERS,
    }),
  );
  app.use(compression());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      redact: ['req.headers.authorization'],
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );

  app.use('/uploads', express.static('uploads'));

  app.use(createApiRouter({ controllers, database }));

  setupSwagger(app);

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
