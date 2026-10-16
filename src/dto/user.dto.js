'use strict';

const pickFields = require('../utils/pickFields');

/**
 * Campos de un usuario que pueden persistirse.
 *
 * @readonly
 * @type {readonly string[]}
 */
const USER_FIELDS = Object.freeze(['username', 'nombre', 'apellido', 'rol', 'email', 'password']);

/**
 * Construye el payload de un usuario filtrando los campos no permitidos.
 *
 * @param {object} [body={}] Cuerpo de la petición.
 * @returns {object} Payload seguro para inserción/actualización.
 */
function buildUserPayload(body = {}) {
  return pickFields(body, USER_FIELDS);
}

module.exports = { USER_FIELDS, buildUserPayload };
