'use strict';

const rateLimit = require('express-rate-limit');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Limitador de peticiones para rutas sensibles (login), mitigando ataques de
 * fuerza bruta. Aplica el patrón **Strategy** permitiendo distintos límites por
 * ruta sin duplicar configuración.
 *
 * @param {object} [options] Opciones de configuración.
 * @param {number} [options.windowMs] Ventana de tiempo en milisegundos.
 * @param {number} [options.max] Número máximo de peticiones por ventana.
 * @returns {import('express').RequestHandler} Middleware limitador.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      message: 'Demasiados intentos. Inténtelo de nuevo más tarde.',
    },
  });
}

module.exports = { createRateLimiter };
