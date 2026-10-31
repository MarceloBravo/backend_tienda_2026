'use strict';

const AppError = require('../errors/AppError');
const { extractBearerToken, verifyAccessToken } = require('../utils/accessToken');

/**
 * Fábrica del middleware de autenticación opcional.
 *
 * Permite tres escenarios:
 * - `Authorization: Bearer <token>`: autentica al usuario en `req.user`.
 * - `X-Guest-Token: <token>`: autentica al invitado en `req.guest`.
 * - Sin token: continúa sin identidad para que el controlador decida.
 *
 * Enviar ambos tokens a la vez se rechaza para evitar ambigüedad.
 *
 * @param {object} deps Dependencias del middleware.
 * @param {import('../services/guestToken.service').GuestTokenService} deps.guestTokenService Servicio de tokens de invitado.
 * @returns {import('express').RequestHandler} Middleware de autenticación opcional.
 */
function createOptionalAuth({ guestTokenService } = {}) {
  return function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const guestToken = req.headers['x-guest-token'];

    if (authHeader && guestToken) {
      next(AppError.badRequest('No combine el token de usuario con el token de invitado.'));
      return;
    }

    if (authHeader) {
      autenticarUsuario(authHeader, req, next);
      return;
    }

    if (guestToken) {
      autenticarInvitado(guestToken, req, next, guestTokenService);
      return;
    }

    next();
  };
}

/**
 * Verifica el token de usuario y lo adjunta a la petición.
 *
 * @param {string} authHeader Encabezado `Authorization`.
 * @param {import('express').Request} req Petición HTTP.
 * @param {import('express').NextFunction} next Siguiente middleware.
 * @returns {void}
 */
function autenticarUsuario(authHeader, req, next) {
  const token = extractBearerToken(authHeader);
  if (!token) {
    next(AppError.unauthorized('Token inválido.'));
    return;
  }

  try {
    req.user = verifyAccessToken(token).user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Verifica el token de invitado y lo adjunta a la petición.
 *
 * @param {string} guestToken Token de invitado.
 * @param {import('express').Request} req Petición HTTP.
 * @param {import('express').NextFunction} next Siguiente middleware.
 * @param {import('../services/guestToken.service').GuestTokenService} guestTokenService Servicio de tokens.
 * @returns {void}
 */
function autenticarInvitado(guestToken, req, next, guestTokenService) {
  if (!guestTokenService) {
    next(AppError.unauthorized('Token de invitado no configurado.'));
    return;
  }

  try {
    req.guest = guestTokenService.verificar(guestToken);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { createOptionalAuth };
