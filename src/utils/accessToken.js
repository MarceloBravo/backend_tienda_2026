'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');

/**
 * Utilidades compartidas para extraer y verificar el JWT de acceso de un
 * usuario. Evita duplicar la lógica entre autenticación obligatoria y opcional.
 *
 * @module utils/accessToken
 */

/**
 * Extrae el token de un encabezado `Authorization: Bearer <token>`.
 *
 * @param {string|undefined} header Valor del encabezado `Authorization`.
 * @returns {string|null} Token o `null` si el encabezado no es válido.
 */
function extractBearerToken(header) {
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verifica y decodifica un token de acceso de usuario.
 *
 * @param {string} token Token JWT de acceso.
 * @returns {object} Payload decodificado con la propiedad `user`.
 * @throws {AppError} 401 si el token es inválido, expirado o no contiene usuario.
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRETS);
    if (!decoded || !decoded.user) {
      throw new Error('Payload de acceso inválido.');
    }
    return decoded;
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'Token expirado.' : 'Token inválido.';
    throw AppError.unauthorized(message);
  }
}

module.exports = {
  extractBearerToken,
  verifyAccessToken,
};
