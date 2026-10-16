'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');

/**
 * Middleware de autenticación. Verifica el token JWT del encabezado
 * `Authorization: Bearer <token>` y adjunta el usuario decodificado en `req.user`.
 *
 * @param {import('express').Request} req Petición HTTP.
 * @param {import('express').Response} res Respuesta HTTP.
 * @param {import('express').NextFunction} next Siguiente middleware.
 * @returns {void}
 * @throws {AppError} 401 si falta el token o es inválido/expirado.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    next(AppError.unauthorized('Acceso denegado. Token requerido.'));
    return;
  }

  jwt.verify(token, process.env.TOKEN_SECRETS, (err, decoded) => {
    if (err) {
      const message = err.name === 'TokenExpiredError' ? 'Token expirado.' : 'Token inválido.';
      next(AppError.unauthorized(message));
      return;
    }
    req.user = decoded.user;
    next();
  });
}

module.exports = authenticateToken;
