'use strict';

const pickFields = require('../utils/pickFields');

/**
 * Campos de un producto que pueden persistirse. Cualquier campo fuera de esta
 * lista se descarta, evitando escrituras no autorizadas (*mass assignment*).
 *
 * @readonly
 * @type {readonly string[]}
 */
const PRODUCT_FIELDS = Object.freeze([
  'asin',
  'climate_pledge_friendly',
  'currency',
  'delivery',
  'has_variations',
  'is_amazon_choice',
  'is_best_seller',
  'is_prime',
  'product_badge',
  'product_minimum_offer_price',
  'product_num_offers',
  'product_num_ratings',
  'product_original_price',
  'product_photo',
  'product_price',
  'product_star_rating',
  'product_title',
  'product_url',
  'sales_volume',
]);

/**
 * Construye el payload de un producto filtrando los campos no permitidos.
 *
 * @param {object} [body={}] Cuerpo de la petición.
 * @returns {object} Payload seguro para inserción/actualización.
 */
function buildProductPayload(body = {}) {
  return pickFields(body, PRODUCT_FIELDS);
}

module.exports = { PRODUCT_FIELDS, buildProductPayload };
