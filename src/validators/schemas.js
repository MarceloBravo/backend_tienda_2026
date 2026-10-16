'use strict';

const { z } = require('zod');
const { ROLES, PAGINATION } = require('../config/constants');

/**
 * Transforma un valor de formulario en booleano.
 *
 * @param {*} value Valor de entrada (`true`, `'true'`, `'1'`, `1`...).
 * @returns {boolean} Valor booleano normalizado.
 */
const toBoolean = (value) => value === true || value === 'true' || value === '1' || value === 1;

/**
 * Campo booleano opcional que acepta el formato de `multipart/form-data`.
 *
 * @type {import('zod').ZodType<boolean | undefined>}
 */
const optionalBoolean = z
  .preprocess((value) => (value === undefined ? undefined : toBoolean(value)), z.boolean())
  .optional();

/**
 * Esquema de validación para el login.
 *
 * @type {import('zod').ZodObject<*>}
 */
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('El email no tiene un formato válido.'),
  password: z.string().min(1, 'El password es obligatorio.').max(255),
});

/**
 * Campos comunes de un usuario reutilizados por los esquemas de creación y edición
 * (patrón **Strategy**: cada operación compone su propio esquema).
 */
const userBaseShape = {
  username: z.string().trim().min(1).max(20),
  nombre: z.string().trim().min(1).max(20),
  apellido: z.string().trim().min(1).max(20),
  rol: z.enum(Object.values(ROLES), { message: 'El rol no es válido.' }),
  email: z.string().trim().toLowerCase().email('El email no tiene un formato válido.'),
};

/**
 * Esquema de creación de usuario (password obligatorio).
 *
 * @type {import('zod').ZodObject<*>}
 */
const createUserSchema = z.object({
  ...userBaseShape,
  password: z.string().min(6, 'El password debe tener al menos 6 caracteres.').max(255),
});

/**
 * Esquema de actualización de usuario (password opcional).
 *
 * @type {import('zod').ZodObject<*>}
 */
const updateUserSchema = z.object({
  ...userBaseShape,
  password: z.string().max(255).optional().or(z.literal('')),
});

/**
 * Campos comunes de un producto.
 */
const productBaseShape = {
  climate_pledge_friendly: optionalBoolean,
  currency: z.string().trim().min(1, 'El campo currency es obligatorio.').max(10),
  delivery: z.string().trim().max(255).optional(),
  has_variations: optionalBoolean,
  is_amazon_choice: optionalBoolean,
  is_best_seller: optionalBoolean,
  is_prime: optionalBoolean,
  product_badge: z.string().trim().max(255).optional(),
  product_minimum_offer_price: z.coerce.number().nonnegative().optional(),
  product_num_offers: z.coerce.number().int().nonnegative().optional(),
  product_num_ratings: z.coerce.number().int().nonnegative().optional(),
  product_original_price: z.coerce.number().nonnegative().optional(),
  product_photo: z.string().trim().optional(),
  product_price: z.coerce
    .number()
    .nonnegative({ message: 'El campo product_price es obligatorio.' }),
  product_star_rating: z.coerce.number().min(0).max(5).optional(),
  product_title: z.string().trim().min(1, 'El campo product_title es obligatorio.'),
  product_url: z.string().trim().optional(),
  sales_volume: z.string().trim().max(255).optional(),
};

/**
 * Esquema de creación de producto (asin obligatorio).
 *
 * @type {import('zod').ZodObject<*>}
 */
const createProductSchema = z.object({
  asin: z.string().trim().min(1, 'El campo asin es obligatorio.').max(255),
  ...productBaseShape,
});

/**
 * Esquema de actualización de producto (asin proviene del parámetro de ruta).
 *
 * @type {import('zod').ZodObject<*>}
 */
const updateProductSchema = z.object(productBaseShape);

/**
 * Esquema de parámetros de paginación (`search`, `page`, `limit`).
 *
 * @type {import('zod').ZodObject<*>}
 */
const paginationSchema = z.object({
  search: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().positive().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

module.exports = {
  loginSchema,
  createUserSchema,
  updateUserSchema,
  createProductSchema,
  updateProductSchema,
  paginationSchema,
};
