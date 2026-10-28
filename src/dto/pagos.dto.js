'use strict';

/**
 * DTO factory para pagos con Transbank.
 * Aplica whitelist de campos.
 *
 * @module dto/pagos.dto
 */

/**
 * Crea payload para crear orden.
 *
 * @param {object} body Cuerpo de la petición.
 * @returns {object} Payload sanitizado.
 */
function crearOrdenPayload(body) {
  const payload = {};
  if (Array.isArray(body.items)) {
    payload.items = body.items.map((item) => {
      const sanitized = {};
      if (item.asin) sanitized.asin = String(item.asin);
      if (item.productoId) sanitized.productoId = String(item.productoId);
      if (item.cantidad !== undefined && item.cantidad !== null) sanitized.cantidad = item.cantidad;
      return sanitized;
    });
  }
  if (body.direccionEnvio !== undefined) {
    payload.direccionEnvio = body.direccionEnvio === null ? null : String(body.direccionEnvio);
  }
  return payload;
}

/**
 * Crea payload para iniciar pago.
 *
 * @param {object} body Cuerpo de la petición.
 * @returns {object} Payload sanitizado.
 */
function iniciarPagoPayload(body) {
  const payload = {};
  if (body.ordenId !== undefined && body.ordenId !== null) {
    payload.ordenId = body.ordenId;
  }
  return payload;
}

module.exports = {
  crearOrdenPayload,
  iniciarPagoPayload,
};
