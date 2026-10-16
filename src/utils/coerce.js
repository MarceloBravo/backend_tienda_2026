'use strict';

/**
 * Normaliza un valor de formulario a booleano.
 *
 * @param {*} value Valor de entrada (`true`, `'true'`, `'1'`, `1`...).
 * @returns {boolean} Valor booleano normalizado.
 */
function toBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

/**
 * Convierte un valor a número, devolviendo `undefined` si no es numérico.
 *
 * @param {*} value Valor de entrada.
 * @returns {number|undefined} Número parseado o `undefined`.
 */
function toOptionalNumber(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

module.exports = { toBoolean, toOptionalNumber };
