'use strict';

/**
 * Roles disponibles en el sistema. Se usan para el control de acceso
 * (`authorize`) y para evitar cadenas mágicas repartidas por el código.
 *
 * @readonly
 * @enum {string}
 */
const ROLES = Object.freeze({
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  INVITADO: 'invitado',
});

/**
 * Códigos de estado HTTP usados por la API.
 *
 * @readonly
 * @enum {number}
 */
const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
});

/**
 * Códigos de error de dominio devueltos en el cuerpo de las respuestas.
 *
 * @readonly
 * @enum {string}
 */
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL_ERROR',
});

/**
 * Valores por defecto de la paginación.
 *
 * @readonly
 */
const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
});

module.exports = { ROLES, HTTP_STATUS, ERROR_CODES, PAGINATION };
