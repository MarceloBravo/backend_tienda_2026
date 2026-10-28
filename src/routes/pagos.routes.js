'use strict';

const { Router } = require('express');
const validate = require('../validators/validate.middleware');
const authenticateToken = require('../middlewares/auth.middleware');
const { crearOrdenSchema, iniciarPagoSchema } = require('../validators/pagos.validator');
const bind = require('./wrap');

/**
 * Construye el router de pagos con Transbank (Webpay Plus / Redcompra).
 *
 * @param {import('../controllers/transbank.controller')} controller Controlador de pagos.
 * @returns {import('express').Router} Router con las rutas de pagos.
 */
function createPagosRouter(controller) {
  const router = Router();

  /**
   * @openapi
   * /api/pagos/crear-orden:
   *   post:
   *     tags: [Pagos]
   *     summary: Crear orden desde el carrito
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [items]
   *             properties:
   *               items:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     asin: { type: string }
   *                     productoId: { type: string }
   *                     cantidad: { type: integer, minimum: 1 }
   *               direccionEnvio: { type: string, nullable: true }
   *     responses:
   *       201:
   *         description: Orden creada
   *       400:
   *         description: Carrito inválido
   *       401:
   *         description: No autenticado
   */
  router.post(
    '/pagos/crear-orden',
    authenticateToken,
    validate(crearOrdenSchema),
    bind(controller, 'crearOrden'),
  );

  /**
   * @openapi
   * /api/pagos/iniciar:
   *   post:
   *     tags: [Pagos]
   *     summary: Iniciar transacción con Webpay Plus
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [ordenId]
   *             properties:
   *               ordenId: { type: integer, minimum: 1 }
   *     responses:
   *       200:
   *         description: Transacción iniciada (`url` y `token` para redirigir)
   *       403:
   *         description: La orden no pertenece al usuario
   *       404:
   *         description: Orden no encontrada
   */
  router.post(
    '/pagos/iniciar',
    authenticateToken,
    validate(iniciarPagoSchema),
    bind(controller, 'iniciarPago'),
  );

  /**
   * @openapi
   * /api/pagos/retorno:
   *   post:
   *     tags: [Pagos]
   *     summary: Retorno desde Transbank (confirmación del pago)
   *     description: Endpoint público llamado por Transbank. Confirma el pago con `token_ws`.
   *     responses:
   *       200:
   *         description: Resultado de la confirmación
   *   get:
   *     tags: [Pagos]
   *     summary: Retorno desde Transbank (GET)
   *     responses:
   *       200:
   *         description: Resultado de la confirmación
   */
  router.post('/pagos/retorno', bind(controller, 'retorno'));
  router.get('/pagos/retorno', bind(controller, 'retorno'));

  /**
   * @openapi
   * /api/pagos/estado/{ordenId}:
   *   get:
   *     tags: [Pagos]
   *     summary: Consultar estado de una orden y su pago
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: ordenId
   *         required: true
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: Estado de la orden y pago asociado
   *       404:
   *         description: Orden no encontrada
   */
  router.get('/pagos/estado/:ordenId', authenticateToken, bind(controller, 'estado'));

  return router;
}

module.exports = createPagosRouter;
