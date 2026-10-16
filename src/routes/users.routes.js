'use strict';

const { Router } = require('express');
const validate = require('../validators/validate.middleware');
const { createUserSchema, updateUserSchema, paginationSchema } = require('../validators/schemas');
const authenticateToken = require('../middlewares/auth.middleware');
const { authorize, ADMIN_ROLES, MANAGER_ROLES } = require('../middlewares/authorize.middleware');
const bind = require('./wrap');

/**
 * Construye el router de usuarios con control de autenticación y roles.
 *
 * @param {import('../controllers/users.controller')} controller Controlador de usuarios.
 * @returns {import('express').Router} Router con las rutas de usuarios y `/register`.
 */
function createUsersRouter(controller) {
  const router = Router();

  /**
   * @openapi
   * /api/users:
   *   get:
   *     tags: [Users]
   *     summary: Lista usuarios (búsqueda y paginación)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: query, name: search, schema: { type: string } }
   *       - { in: query, name: page, schema: { type: integer, default: 1 } }
   *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
   *     responses:
   *       200:
   *         description: Lista de usuarios
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *   post:
   *     tags: [Users]
   *     summary: Crea un usuario (solo administradores)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UserInput'
   *     responses:
   *       201:
   *         description: Usuario creado
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       409:
   *         $ref: '#/components/responses/Conflict'
   */
  router.get(
    '/users',
    authenticateToken,
    validate(paginationSchema, 'query'),
    bind(controller, 'getAllUsers'),
  );
  router.post(
    '/users',
    authenticateToken,
    authorize(...ADMIN_ROLES),
    validate(createUserSchema),
    bind(controller, 'createUser'),
  );

  /**
   * @openapi
   * /api/register:
   *   post:
   *     tags: [Users]
   *     summary: Registro público de usuario
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UserInput'
   *     responses:
   *       201:
   *         description: Usuario registrado
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       409:
   *         $ref: '#/components/responses/Conflict'
   */
  router.post('/register', validate(createUserSchema), bind(controller, 'createUser'));

  /**
   * @openapi
   * /api/users/{id}:
   *   get:
   *     tags: [Users]
   *     summary: Obtiene un usuario por id
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: integer } }
   *     responses:
   *       200:
   *         description: Usuario encontrado
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   put:
   *     tags: [Users]
   *     summary: Actualiza un usuario
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: integer } }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UserInput'
   *     responses:
   *       200:
   *         description: Usuario actualizado
   *       400:
   *         $ref: '#/components/responses/BadRequest'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *   delete:
   *     tags: [Users]
   *     summary: Elimina un usuario (solo administradores)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - { in: path, name: id, required: true, schema: { type: integer } }
   *     responses:
   *       200:
   *         description: Usuario eliminado
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  router.get('/users/:id', authenticateToken, bind(controller, 'getUserById'));
  router.put(
    '/users/:id',
    authenticateToken,
    authorize(...MANAGER_ROLES),
    validate(updateUserSchema),
    bind(controller, 'updateUser'),
  );
  router.delete(
    '/users/:id',
    authenticateToken,
    authorize(...ADMIN_ROLES),
    bind(controller, 'deleteUser'),
  );

  return router;
}

module.exports = createUsersRouter;
