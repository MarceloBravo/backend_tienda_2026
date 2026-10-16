'use strict';

/**
 * Construye un objeto nuevo conservando únicamente los campos permitidos que
 * estén presentes en el origen. Es la base del patrón **Factory** de DTOs que
 * evita el *mass assignment* (escritura de columnas no autorizadas).
 *
 * @param {object} source Objeto de origen (p. ej. `req.body`).
 * @param {readonly string[]} allowedFields Campos autorizados.
 * @returns {object} Objeto con los campos permitidos presentes en el origen.
 */
function pickFields(source, allowedFields) {
  const target = {};
  for (const field of allowedFields) {
    if (source[field] !== undefined) {
      target[field] = source[field];
    }
  }
  return target;
}

module.exports = pickFields;
