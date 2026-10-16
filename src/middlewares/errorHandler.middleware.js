'use strict';

const logger = require('../utils/logger');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Manejador global de errores de Express. Traduce excepciones (principalmente
 * `AppError`) a respuestas HTTP, registra el error con el logger y evita
 * filtrar detalles internos en respuestas 5xx.
 *
 * @param {Error & {statusCode?: number, status?: number, code?: string, isOperational?: boolean}} err Error capturado.
 * @param {import('express').Request} req Petición HTTP.
 * @param {import('express').Response} res Respuesta HTTP.
 * @param {import('express').NextFunction} _next Siguiente middleware (no usado).
 * @returns {import('express').Response} Respuesta con el error formateado.
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const isServerError = statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;

  if (isServerError) {
    logger.error({ err }, 'Error no controlado');
  } else {
    logger.warn({ message: err.message, statusCode }, 'Error controlado');
  }

  const message =
    isServerError && !err.isOperational
      ? 'Ocurrió un error inesperado en el servidor.'
      : err.message || 'Ocurrió un error inesperado en el servidor.';

  const body = { status: 'error', statusCode, message };
  if (err.code) {
    body.code = err.code;
  }

  return res.status(statusCode).json(body);
}

module.exports = errorHandler;
