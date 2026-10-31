'use strict';

const AppError = require('../errors/AppError');

/**
 * Mensaje único para no revelar si la orden existe o a quién pertenece.
 *
 * @readonly
 * @type {string}
 */
const MENSAJE_NO_AUTORIZADO = 'No autorizado para operar sobre esta orden.';

/**
 * Política central de acceso a órdenes.
 * Decide si un usuario autenticado o un invitado puede operar sobre una orden
 * concreta, sin usar `usuario_id = NULL` como comodín.
 *
 * @class OrderAccessService
 */
class OrderAccessService {
  /**
   * Valida el acceso a una orden ya cargada.
   *
   * @param {object} orden Orden con `id`, `usuario_id`, `buy_order` y `es_invitado`.
   * @param {object} [identidad] Identidad de la petición.
   * @param {object|null} [identidad.usuario] Usuario autenticado (`req.user`).
   * @param {{ordenId: number, buyOrder: string}|null} [identidad.guest] Invitado (`req.guest`).
   * @returns {void}
   * @throws {AppError} 401 si falta identidad y 403 si no coincide con la orden.
   */
  assertPuedeAcceder(orden, { usuario = null, guest = null } = {}) {
    if (this.esOrdenInvitado(orden)) {
      this.validarInvitado(orden, guest);
      return;
    }

    this.validarUsuario(orden, usuario);
  }

  /**
   * Determina si la orden fue creada por un invitado.
   *
   * @param {object} orden Orden a evaluar.
   * @returns {boolean} `true` si `es_invitado` vale 1.
   */
  esOrdenInvitado(orden) {
    return Number(orden?.es_invitado) === 1;
  }

  /**
   * Valida que el token de invitado corresponda exactamente a la orden.
   *
   * @param {object} orden Orden de invitado.
   * @param {{ordenId: number, buyOrder: string}|null} guest Identidad de invitado.
   * @returns {void}
   * @throws {AppError} 401 si no hay token y 403 si no coincide.
   */
  validarInvitado(orden, guest) {
    if (!guest) {
      throw AppError.unauthorized('Se requiere token de invitado para acceder a esta orden.');
    }

    const mismoId = Number(guest.ordenId) === Number(orden.id);
    const mismoBuyOrder = String(guest.buyOrder) === String(orden.buy_order);
    if (!mismoId || !mismoBuyOrder) {
      throw AppError.forbidden(MENSAJE_NO_AUTORIZADO);
    }
  }

  /**
   * Valida que el usuario autenticado sea el dueño de la orden.
   *
   * @param {object} orden Orden de usuario.
   * @param {object|null} usuario Usuario autenticado.
   * @returns {void}
   * @throws {AppError} 401 si no hay usuario y 403 si no es el dueño.
   */
  validarUsuario(orden, usuario) {
    if (!usuario) {
      throw AppError.unauthorized('Acceso denegado. Token requerido.');
    }

    if (Number(orden.usuario_id) !== Number(usuario.id)) {
      throw AppError.forbidden(MENSAJE_NO_AUTORIZADO);
    }
  }
}

module.exports = { OrderAccessService, MENSAJE_NO_AUTORIZADO };
