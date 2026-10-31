'use strict';

const { randomUUID } = require('crypto');

/**
 * Utilidades para generar `buy_order` compatibles con Webpay Plus.
 * Webpay Plus limita el `buy_order` a 26 caracteres, por lo que la generación
 * y la derivación de intentos se centralizan aquí.
 *
 * @module utils/buyOrder
 */

/**
 * Longitud máxima aceptada por Webpay Plus para `buy_order`.
 *
 * @readonly
 * @type {number}
 */
const BUY_ORDER_MAX_LENGTH = 26;

/**
 * Genera un `buy_order` estable para una orden.
 *
 * @returns {string} Buy order único de la orden.
 */
function generarBuyOrder() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const uuid = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ORD-${timestamp}-${uuid}`.slice(0, BUY_ORDER_MAX_LENGTH);
}

/**
 * Deriva un `buy_order` único para un intento de pago a partir del buy order
 * estable de la orden. Se conserva un prefijo del identificador original y se
 * agrega un sufijo temporal aleatorio para evitar colisiones entre intentos.
 *
 * @param {string} buyOrderBase Buy order estable de la orden.
 * @returns {string} Buy order del intento, con máximo 26 caracteres.
 */
function generarBuyOrderIntento(buyOrderBase) {
  const base = String(buyOrderBase || generarBuyOrder());
  const sufijo = `-${Date.now().toString(36).slice(-5)}${randomUUID()
    .replace(/-/g, '')
    .slice(0, 3)}`.toUpperCase();
  const longitudBase = Math.max(BUY_ORDER_MAX_LENGTH - sufijo.length, 0);
  return `${base.slice(0, longitudBase)}${sufijo}`;
}

module.exports = {
  BUY_ORDER_MAX_LENGTH,
  generarBuyOrder,
  generarBuyOrderIntento,
};
