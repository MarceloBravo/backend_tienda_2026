'use strict';

/**
 * Determina si un error de MySQL corresponde a una violación de clave única.
 *
 * @param {Error} error Error capturado en la capa de acceso a datos.
 * @returns {boolean} `true` si el error es de duplicado (`ER_DUP_ENTRY`).
 */
function isDuplicateEntry(error) {
  return Boolean(error) && error.code === 'ER_DUP_ENTRY';
}

module.exports = { isDuplicateEntry };
