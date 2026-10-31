'use strict';

/**
 * Reglas de negocio compartidas para interpretar las respuestas de Transbank.
 * Centralizarlas evita que la condición de autorización se duplique y diverja
 * entre el servicio y el modelo de pagos.
 *
 * @module utils/transbank
 */

/**
 * Estados internos de un pago persistido.
 *
 * @readonly
 * @enum {string}
 */
const ESTADOS_PAGO = Object.freeze({
  INICIADO: 'INICIADO',
  AUTORIZADO: 'AUTORIZADO',
  RECHAZADO: 'RECHAZADO',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR',
});

/**
 * Verifica si un `response_code` corresponde a una aprobación.
 * Se descartan `null`, `undefined` y cadena vacía para no confundirlos con `0`.
 *
 * @param {number|string|null|undefined} responseCode Código de respuesta de Transbank.
 * @returns {boolean} `true` solo si el código representa un `0`.
 */
function esCodigoAprobado(responseCode) {
  if (responseCode === null || responseCode === undefined || responseCode === '') {
    return false;
  }
  return Number(responseCode) === 0;
}

/**
 * Determina si una respuesta de Transbank corresponde a una transacción
 * autorizada. La regla oficial exige **ambas** condiciones: `status` igual a
 * `AUTHORIZED` y `response_code` igual a `0`.
 *
 * @param {object|null|undefined} response Respuesta de `commit` o `status`.
 * @returns {boolean} `true` si la transacción fue autorizada.
 */
function esTransaccionAutorizada(response) {
  if (!response) return false;
  return response.status === 'AUTHORIZED' && esCodigoAprobado(response.response_code);
}

/**
 * Traduce una respuesta de Transbank al estado interno del pago.
 *
 * @param {object|null|undefined} response Respuesta de `commit` o `status`.
 * @returns {string} Estado del pago (`AUTORIZADO`, `RECHAZADO` o `INICIADO`).
 */
function determinarEstadoPago(response) {
  if (esTransaccionAutorizada(response)) {
    return ESTADOS_PAGO.AUTORIZADO;
  }
  if (!response) {
    return ESTADOS_PAGO.INICIADO;
  }
  if (response.status === 'FAILED') {
    return ESTADOS_PAGO.RECHAZADO;
  }
  if (
    response.response_code !== null &&
    response.response_code !== undefined &&
    !esCodigoAprobado(response.response_code)
  ) {
    return ESTADOS_PAGO.RECHAZADO;
  }
  return ESTADOS_PAGO.INICIADO;
}

module.exports = {
  ESTADOS_PAGO,
  esCodigoAprobado,
  esTransaccionAutorizada,
  determinarEstadoPago,
};
