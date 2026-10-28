'use strict';

const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const sendResponse = require('../utils/response');
const { HTTP_STATUS } = require('../config/constants');
const createLoginRouter = require('./login.routes');
const createUsersRouter = require('./users.routes');
const createProductosRouter = require('./productos.routes');
const createPagosRouter = require('./pagos.routes');

/**
 * Comprueba el estado de la base de datos sin lanzar excepción.
 *
 * @param {import('../db').Database} database Adaptador de base de datos.
 * @returns {Promise<boolean>} `true` si la base de datos responde.
 */
async function isDatabaseUp(database) {
  try {
    await database.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Compone el router raíz de la API agrupando los sub-routers por dominio.
 * Centraliza el registro de rutas para que `app.js` no las conozca una a una.
 *
 * @param {object} deps Dependencias del router.
 * @param {object} deps.controllers Controladores ya construidos.
 * @param {import('../db').Database} deps.database Adaptador de base de datos.
 * @returns {import('express').Router} Router con `/api/*` montado.
 */
function createApiRouter({ controllers, database }) {
  const router = Router();

  /**
   * @openapi
   * /api/health:
   *   get:
   *     tags: [Health]
   *     summary: Estado de la aplicación y la base de datos
   *     responses:
   *       200:
   *         description: Servicio saludable
   *       503:
   *         description: Base de datos no disponible
   */
  router.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      const databaseUp = await isDatabaseUp(database);
      return sendResponse(res, {
        statusCode: databaseUp ? HTTP_STATUS.OK : 503,
        message: databaseUp ? 'Servicio saludable.' : 'Servicio degradado.',
        data: { database: databaseUp ? 'up' : 'down' },
      });
    }),
  );

  router.use('/api', createLoginRouter(controllers.loginController));
  router.use('/api', createUsersRouter(controllers.usersController));
  router.use('/api', createProductosRouter(controllers.productosController));
  if (controllers.transbankController) {
    router.use('/api', createPagosRouter(controllers.transbankController));
  }

  return router;
}

module.exports = createApiRouter;
