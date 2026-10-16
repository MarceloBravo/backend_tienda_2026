'use strict';

/**
 * Envuelve un controlador asíncrono para capturar los rechazos de promesa y
 * delegarlos a Express mediante `next`, evitando repetir bloques `try/catch`.
 * Patrón de orden superior (higher-order function).
 *
 * @param {Function} handler Función de controlador `(req, res, next) => Promise<void>`.
 * @returns {import('express').RequestHandler} Controlador envuelto.
 */
function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
