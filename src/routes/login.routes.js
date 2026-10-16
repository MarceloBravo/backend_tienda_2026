'use strict';

const { Router } = require('express');
const validate = require('../validators/validate.middleware');
const { loginSchema } = require('../validators/schemas');
const { createRateLimiter } = require('../middlewares/rateLimit.middleware');
const bind = require('./wrap');

/**
 * Construye el router de autenticación.
 *
 * @param {import('../controllers/login.controller')} controller Controlador de login.
 * @returns {import('express').Router} Router con las rutas `/login`, `/logout` y `/refreshToken`.
 */
function createLoginRouter(controller) {
  const router = Router();
  const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

  /**
   * @openapi
   * /api/login:
   *   post:
   *     tags: [Auth]
   *     summary: Inicia sesión y emite un par de tokens
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *     responses:
   *       200:
   *         description: Tokens emitidos
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TokenResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  router.post('/login', loginRateLimiter, validate(loginSchema), bind(controller, 'login'));

  /**
   * @openapi
   * /api/logout:
   *   post:
   *     tags: [Auth]
   *     summary: Cierra la sesión invalidando el refresh token
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refreshToken]
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: Sesión cerrada
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  router.post('/logout', bind(controller, 'logout'));

  /**
   * @openapi
   * /api/refreshToken:
   *   post:
   *     tags: [Auth]
   *     summary: Renueva el par de tokens
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refreshToken]
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tokens renovados
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TokenResponse'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
  router.post('/refreshToken', bind(controller, 'refreshToken'));

  return router;
}

module.exports = createLoginRouter;
