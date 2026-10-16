'use strict';

const { ERROR_CODES, HTTP_STATUS } = require('../config/constants');

/**
 * Error de aplicación con estado HTTP y código de dominio asociados.
 * Permite que services y controllers lancen excepciones semánticas que el
 * `errorHandler` traduce a una respuesta HTTP sin filtrar detalles internos.
 *
 * @augments Error
 */
class AppError extends Error {
  /**
   * @param {string} message Mensaje legible para el usuario final.
   * @param {number} [statusCode=HTTP_STATUS.INTERNAL_SERVER_ERROR] Código HTTP a devolver.
   * @param {string} [code=ERROR_CODES.INTERNAL] Código de dominio del error.
   * @param {object} [options] Opciones adicionales para el Error.
   * @param {Error} [options.cause] Error original que provocó esta excepción.
   */
  constructor(
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code = ERROR_CODES.INTERNAL,
    options = {},
  ) {
    super(message, options);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Crea un `AppError` de tipo 400 (Bad Request).
   *
   * @param {string} [message] Mensaje del error.
   * @returns {AppError} Instancia configurada con estado 400.
   */
  static badRequest(message = 'Solicitud inválida.') {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
  }

  /**
   * Crea un `AppError` de tipo 401 (Unauthorized).
   *
   * @param {string} [message] Mensaje del error.
   * @returns {AppError} Instancia configurada con estado 401.
   */
  static unauthorized(message = 'No autorizado.') {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
  }

  /**
   * Crea un `AppError` de tipo 403 (Forbidden).
   *
   * @param {string} [message] Mensaje del error.
   * @returns {AppError} Instancia configurada con estado 403.
   */
  static forbidden(message = 'No tiene permisos para realizar esta acción.') {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN);
  }

  /**
   * Crea un `AppError` de tipo 404 (Not Found).
   *
   * @param {string} [message] Mensaje del error.
   * @returns {AppError} Instancia configurada con estado 404.
   */
  static notFound(message = 'Recurso no encontrado.') {
    return new AppError(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
  }

  /**
   * Crea un `AppError` de tipo 409 (Conflict).
   *
   * @param {string} [message] Mensaje del error.
   * @returns {AppError} Instancia configurada con estado 409.
   */
  static conflict(message = 'El recurso ya existe o entra en conflicto.') {
    return new AppError(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
  }
}

module.exports = AppError;
