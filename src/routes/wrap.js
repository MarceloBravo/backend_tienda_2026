'use strict';

const asyncHandler = require('../utils/asyncHandler');

/**
 * Enlaza un método de controlador a su instancia y lo envuelve con
 * `asyncHandler`, de modo que los controladores no repitan `try/catch` y las
 * rutas declaren middleware de forma uniforme.
 *
 * @param {object} controller Instancia del controlador.
 * @param {string} methodName Nombre del método público del controlador.
 * @returns {import('express').RequestHandler} Handler listo para Express.
 */
function bind(controller, methodName) {
  return asyncHandler(controller[methodName].bind(controller));
}

module.exports = bind;
