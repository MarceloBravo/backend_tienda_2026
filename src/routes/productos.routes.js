'use strict';

const { Router } = require('express');
const validate = require('../validators/validate.middleware');
const {
  createProductSchema,
  updateProductSchema,
  paginationSchema,
} = require('../validators/schemas');
const upload = require('../middlewares/upload.middleware');
const parseData = require('../middlewares/parseData.middleware');
const bind = require('./wrap');

/**
 * Construye el router de productos. Lectura y escritura son públicas (sin
 * autenticación ni roles); la única barrera es la validación de datos.
 *
 * @param {import('../controllers/productos.controller')} controller Controlador de productos.
 * @returns {import('express').Router} Router con las rutas de productos.
 */
function createProductosRouter(controller) {
  const router = Router();

  /**
   * @openapi
   * /api/productos:
   *   get:
   *     tags: [Productos]
   *     summary: Lista productos (búsqueda y paginación)
   *     parameters:
   *       - { in: query, name: search, schema: { type: string } }
   *       - { in: query, name: page, schema: { type: integer, default: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
   *     responses:
   *       200:
   *         description: Lista de productos
   *   post:
   *     tags: [Productos]
   *     summary: Crea un producto (público)
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             $ref: '#/components/schemas/ProductoInput'
   *     responses:
   *       201:
   *         description: Producto creado
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       409:
   *         $ref: '#/components/responses/Conflict'
   */
  router.get('/productos', validate(paginationSchema, 'query'), bind(controller, 'getAllProducts'));
  router.post(
    '/productos',
    upload.single('product_photo'),
    parseData,
    validate(createProductSchema),
    bind(controller, 'createProduct'),
  );

  /**
   * @openapi
   * /api/productos/{id}:
   *   get:
   *     tags: [Productos]
   *     summary: Obtiene un producto por ASIN
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: Producto encontrado
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   put:
   *     tags: [Productos]
   *     summary: Actualiza un producto (público)
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             $ref: '#/components/schemas/ProductoInput'
   *     responses:
   *       200:
   *         description: Producto actualizado
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   delete:
   *     tags: [Productos]
   *     summary: Elimina un producto (público)
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: string } }
   *     responses:
   *       200:
   *         description: Producto eliminado
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.get('/productos', bind(controller, 'getProductByAsin'));
  router.get('/productos/:id', bind(controller, 'getProductByAsin'));
  router.put(
    '/productos/:id',
    upload.single('product_photo'),
    parseData,
    validate(updateProductSchema),
    bind(controller, 'updateProduct'),
  );
  router.delete('/productos/:id', bind(controller, 'deleteProduct'));

  return router;
}

module.exports = createProductosRouter;
