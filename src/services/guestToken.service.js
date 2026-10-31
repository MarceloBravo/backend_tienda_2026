'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../errors/AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../config/constants');
const { getGuestTokenSecret, getGuestTokenExpires } = require('../config/guestCheckout');

/**
 * Tipo de token incluido en el payload para distinguirlo de un access token.
 *
 * @readonly
 * @type {string}
 */
const GUEST_TOKEN_TYPE = 'guest_order';

/**
 * Audiencia esperada en el token de invitado.
 *
 * @readonly
 * @type {string}
 */
const GUEST_TOKEN_AUDIENCE = 'guest-order';

/**
 * Emisor esperado en el token de invitado.
 *
 * @readonly
 * @type {string}
 */
const GUEST_TOKEN_ISSUER = 'talentosp-tienda';

/**
 * Servicio de tokens de invitado.
 * Emite y verifica JWT de corta duración ligados a una orden y a su buy order.
 *
 * @class GuestTokenService
 */
class GuestTokenService {
  /**
   * @param {object} [options] Opciones del servicio.
   * @param {string|null} [options.secret=null] Secreto explícito (útil en tests).
   * @param {string|null} [options.expiresIn=null] TTL explícito (útil en tests).
   */
  constructor({ secret = null, expiresIn = null } = {}) {
    this.secret = secret;
    this.expiresIn = expiresIn || getGuestTokenExpires();
  }

  /**
   * Obtiene el secreto configurado, ya sea explícito o desde el entorno.
   *
   * @returns {string} Secreto de firma.
   * @throws {Error} Si no hay secreto configurado.
   */
  obtenerSecreto() {
    return this.secret || getGuestTokenSecret();
  }

  /**
   * Emite un token de invitado para una orden concreta.
   *
   * @param {object} data Datos de la orden.
   * @param {number} data.ordenId ID de la orden.
   * @param {string} data.buyOrder Buy order estable de la orden.
   * @returns {string} Token JWT firmado.
   * @throws {AppError} 500 si los datos de la orden son inválidos.
   */
  emitir({ ordenId, buyOrder }) {
    const id = Number(ordenId);
    if (!Number.isInteger(id) || id <= 0 || !buyOrder) {
      throw new AppError(
        'No se pudo emitir el token de invitado.',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL,
      );
    }

    return jwt.sign(
      {
        typ: GUEST_TOKEN_TYPE,
        ordenId: id,
        buyOrder: String(buyOrder),
      },
      this.obtenerSecreto(),
      {
        algorithm: 'HS256',
        audience: GUEST_TOKEN_AUDIENCE,
        issuer: GUEST_TOKEN_ISSUER,
        subject: String(id),
        expiresIn: this.expiresIn,
      },
    );
  }

  /**
   * Verifica un token de invitado y devuelve su alcance.
   *
   * @param {string} token Token JWT de invitado.
   * @returns {{ordenId: number, buyOrder: string}} Orden autorizada por el token.
   * @throws {AppError} 401 si el token es inválido, expirado o de otra audiencia.
   */
  verificar(token) {
    try {
      const payload = jwt.verify(token, this.obtenerSecreto(), {
        algorithms: ['HS256'],
        audience: GUEST_TOKEN_AUDIENCE,
        issuer: GUEST_TOKEN_ISSUER,
      });

      const ordenId = Number(payload.ordenId);
      if (
        payload.typ !== GUEST_TOKEN_TYPE ||
        !Number.isInteger(ordenId) ||
        ordenId <= 0 ||
        !payload.buyOrder
      ) {
        throw new Error('Payload de invitado inválido.');
      }

      return {
        ordenId,
        buyOrder: String(payload.buyOrder),
      };
    } catch (error) {
      throw new AppError(
        'Token de invitado inválido o expirado.',
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        { cause: error },
      );
    }
  }
}

module.exports = {
  GuestTokenService,
  GUEST_TOKEN_TYPE,
  GUEST_TOKEN_AUDIENCE,
  GUEST_TOKEN_ISSUER,
};
