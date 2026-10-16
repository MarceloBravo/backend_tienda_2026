'use strict';

const { toBoolean, toOptionalNumber } = require('../utils/coerce');

/**
 * Campos booleanos que pueden llegar como texto desde `multipart/form-data`.
 *
 * @readonly
 * @type {readonly string[]}
 */
const BOOLEAN_FIELDS = Object.freeze([
  'climate_pledge_friendly',
  'has_variations',
  'is_amazon_choice',
  'is_best_seller',
  'is_prime',
]);

/**
 * Campos numéricos que pueden llegar como texto desde `multipart/form-data`.
 *
 * @readonly
 * @type {readonly string[]}
 */
const NUMBER_FIELDS = Object.freeze([
  'product_minimum_offer_price',
  'product_num_offers',
  'product_num_ratings',
  'product_original_price',
  'product_price',
  'product_star_rating',
]);

/**
 * Middleware que normaliza los tipos de un producto recibido como
 * `multipart/form-data`: convierte los campos booleanos y numéricos que llegan
 * como texto antes de la validación declarativa.
 *
 * @param {import('express').Request} req Petición HTTP.
 * @param {import('express').Response} res Respuesta HTTP.
 * @param {import('express').NextFunction} next Siguiente middleware.
 * @returns {void}
 */
function parseData(req, res, next) {
  const body = req.body;

  for (const field of BOOLEAN_FIELDS) {
    if (body[field] !== undefined) {
      body[field] = toBoolean(body[field]);
    }
  }

  for (const field of NUMBER_FIELDS) {
    if (body[field] !== undefined) {
      const value = toOptionalNumber(body[field]);
      if (value === undefined) {
        delete body[field];
      } else {
        body[field] = value;
      }
    }
  }

  next();
}

module.exports = parseData;
