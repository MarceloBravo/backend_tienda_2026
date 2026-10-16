'use strict';

const AppError = require('../errors/AppError');
const { ROLES } = require('../config/constants');

/**
 * Fábrica de middlewares de autorización (patrón **Strategy**). Cada llamada
 * define una estrategia de acceso basada en los roles permitidos, de modo que
 * añadir un rol no requiere modificar lógica existente (OCP).
 *
 * @param {...string} allowedRoles Roles autorizados a ejecutar la ruta.
 * @returns {import('express').RequestHandler} Middleware que valida el rol del usuario.
 */
function authorize(...allowedRoles) {
  return function authorizationMiddleware(req, res, next) {
    const user = req.user;
    if (!user || !allowedRoles.includes(user.rol)) {
      next(AppError.forbidden('No tiene permisos para realizar esta acción.'));
      return;
    }
    next();
  };
}

/**
 * Roles con permiso de escritura sobre los recursos de administración.
 *
 * @readonly
 * @type {string[]}
 */
const ADMIN_ROLES = [ROLES.ADMIN];

/**
 * Roles con permiso de creación/edición de catálogo.
 *
 * @readonly
 * @type {string[]}
 */
const MANAGER_ROLES = [ROLES.ADMIN, ROLES.SUPERVISOR];

module.exports = { authorize, ADMIN_ROLES, MANAGER_ROLES };
