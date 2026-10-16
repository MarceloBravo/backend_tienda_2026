'use strict';

const { HTTP_STATUS } = require('../config/constants');

/**
 * Envía una respuesta HTTP con un formato uniforme
 * `{ status, message, data }` para toda la API.
 *
 * @param {import('express').Response} res Objeto de respuesta de Express.
 * @param {object} payload Datos de la respuesta.
 * @param {number} [payload.statusCode=HTTP_STATUS.OK] Código HTTP a enviar.
 * @param {string} [payload.message] Mensaje descriptivo de la operación.
 * @param {*} [payload.data] Carga útil de la respuesta.
 * @returns {import('express').Response} El objeto `res` para permitir encadenamiento.
 */
function sendResponse(res, { statusCode = HTTP_STATUS.OK, message, data } = {}) {
  const body = { status: statusCode < HTTP_STATUS.BAD_REQUEST ? 'success' : 'error' };
  if (message !== undefined) {
    body.message = message;
  }
  if (data !== undefined) {
    body.data = data;
  }
  return res.status(statusCode).json(body);
}

module.exports = sendResponse;
