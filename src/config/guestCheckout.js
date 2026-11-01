'use strict';

/**
 * Configuración de la compra como invitado.
 * Centraliza el feature flag, los TTL y la validación de secretos para que
 * rutas, servicios y scripts de limpieza compartan las mismas reglas.
 *
 * @module config/guestCheckout
 */

/**
 * Valor por defecto del TTL del token de invitado.
 *
 * @readonly
 * @type {string}
 */
const DEFAULT_GUEST_TOKEN_EXPIRES = '2h';

/**
 * Valor por defecto del TTL de una orden de invitado abandonada.
 *
 * @readonly
 * @type {number}
 */
const DEFAULT_GUEST_ORDER_TTL_HOURS = 24;

/**
 * Valor por defecto del tamaño de lote de limpieza.
 *
 * @readonly
 * @type {number}
 */
const DEFAULT_ORDER_CLEANUP_BATCH_SIZE = 500;

/**
 * Valor por defecto de retención antes de anonimizar direcciones.
 *
 * @readonly
 * @type {number}
 */
const DEFAULT_ORDER_RETENTION_DAYS = 90;

/**
 * Valor por defecto del TTL de un pago iniciado sin confirmación.
 *
 * @readonly
 * @type {number}
 */
const DEFAULT_PAGO_INICIADO_TTL_HOURS = 24;

/**
 * Indica si la compra como invitado está habilitada.
 *
 * @returns {boolean} `true` solo cuando `GUEST_CHECKOUT_ENABLED=true`.
 */
function isGuestCheckoutEnabled() {
  return (
    String(process.env.GUEST_CHECKOUT_ENABLED || 'false')
      .trim()
      .toLowerCase() === 'true'
  );
}

/**
 * Obtiene el secreto con el que se firman los tokens de invitado.
 *
 * @returns {string} Secreto dedicado de tokens de invitado.
 * @throws {Error} Si `GUEST_TOKEN_SECRETS` no está configurado.
 */
function getGuestTokenSecret() {
  const secret = process.env.GUEST_TOKEN_SECRETS;
  if (!secret) {
    throw new Error(
      'GUEST_TOKEN_SECRETS es obligatorio cuando la compra como invitado está habilitada.',
    );
  }
  return secret;
}

/**
 * Obtiene el TTL del token de invitado.
 *
 * @returns {string} TTL aceptado por `jsonwebtoken` (p. ej. `2h`).
 */
function getGuestTokenExpires() {
  return process.env.GUEST_TOKEN_EXPIRES || DEFAULT_GUEST_TOKEN_EXPIRES;
}

/**
 * Convierte una variable de entorno numérica a entero positivo.
 *
 * @param {string|undefined} value Valor de la variable.
 * @param {number} fallback Valor por defecto.
 * @returns {number} Entero positivo.
 */
function toPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Obtiene las horas de abandono antes de expirar una orden de invitado.
 *
 * @returns {number} Horas configuradas.
 */
function getGuestOrderTtlHours() {
  return toPositiveInteger(process.env.GUEST_ORDER_TTL_HOURS, DEFAULT_GUEST_ORDER_TTL_HOURS);
}

/**
 * Obtiene el tamaño de lote para la limpieza de órdenes.
 *
 * @returns {number} Cantidad máxima de órdenes por lote.
 */
function getOrderCleanupBatchSize() {
  return toPositiveInteger(process.env.ORDER_CLEANUP_BATCH_SIZE, DEFAULT_ORDER_CLEANUP_BATCH_SIZE);
}

/**
 * Obtiene los días de retención antes de anonimizar una dirección.
 *
 * @returns {number} Días configurados.
 */
function getOrderRetentionDays() {
  return toPositiveInteger(process.env.ORDER_RETENTION_DAYS, DEFAULT_ORDER_RETENTION_DAYS);
}

/**
 * Obtiene las horas tras las que un pago iniciado se considera huérfano.
 *
 * @returns {number} Horas configuradas.
 */
function getPagoIniciadoTtlHours() {
  return toPositiveInteger(process.env.PAGO_INICIADO_TTL_HOURS, DEFAULT_PAGO_INICIADO_TTL_HOURS);
}

/**
 * Valida la configuración obligatoria cuando la compra como invitado está
 * habilitada. Se ejecuta al construir el contenedor para fallar rápido.
 *
 * @returns {void}
 * @throws {Error} Si el flag está activo y el secreto falta o se reutiliza.
 */
function assertGuestCheckoutConfig() {
  if (!isGuestCheckoutEnabled()) {
    return;
  }

  const secret = getGuestTokenSecret();
  if (secret === process.env.TOKEN_SECRETS || secret === process.env.REFRESHTOKEN_SECRETS) {
    throw new Error(
      'GUEST_TOKEN_SECRETS debe ser distinto de TOKEN_SECRETS y REFRESHTOKEN_SECRETS.',
    );
  }
}

module.exports = {
  DEFAULT_GUEST_TOKEN_EXPIRES,
  DEFAULT_GUEST_ORDER_TTL_HOURS,
  DEFAULT_ORDER_CLEANUP_BATCH_SIZE,
  DEFAULT_ORDER_RETENTION_DAYS,
  DEFAULT_PAGO_INICIADO_TTL_HOURS,
  isGuestCheckoutEnabled,
  getGuestTokenSecret,
  getGuestTokenExpires,
  getGuestOrderTtlHours,
  getOrderCleanupBatchSize,
  getOrderRetentionDays,
  getPagoIniciadoTtlHours,
  assertGuestCheckoutConfig,
};
