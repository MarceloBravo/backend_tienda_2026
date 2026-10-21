'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

const { createApp } = require('../../src/app');
const AppError = require('../../src/errors/AppError');
const LoginController = require('../../src/controllers/login.controller');
const UsersController = require('../../src/controllers/users.controller');
const ProductosController = require('../../src/controllers/productos.controller');

/**
 * Crea un token JWT válido para un rol dado.
 *
 * @param {string} rol Rol del usuario.
 * @returns {string} Token de acceso firmado.
 */
function tokenFor(rol) {
  return jwt.sign({ user: { id: 1, rol } }, process.env.TOKEN_SECRETS);
}

/**
 * Construye la aplicación y los servicios simulados usados en las pruebas.
 *
 * @param {object} [overrides] Sobrescritura de algún servicio simulado.
 * @returns {{app: import('express').Express, services: object}} App y servicios simulados.
 */
function buildApp(overrides = {}) {
  const services = {
    loginService: {
      login: jest.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r' }),
      logout: jest.fn().mockResolvedValue('Sesión cerrada exitosamente.'),
      refreshToken: jest.fn().mockResolvedValue({ access_token: 'a2', refresh_token: 'r2' }),
    },
    usersService: {
      list: jest.fn().mockResolvedValue([{ id: 1, username: 'pedro' }]),
      getById: jest.fn().mockResolvedValue({ id: 1, username: 'pedro' }),
      create: jest.fn().mockResolvedValue({ id: 2, username: 'nuevo' }),
      update: jest.fn().mockResolvedValue({ id: 1, username: 'pedro' }),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    productosService: {
      list: jest
        .fn()
        .mockResolvedValue({ data: [{ asin: 'A1' }], totProd: 1, page: 1, totPages: 1 }),
      getByAsin: jest.fn().mockResolvedValue({ asin: 'A1' }),
      create: jest.fn().mockResolvedValue({ asin: 'A1' }),
      update: jest.fn().mockResolvedValue({ asin: 'A1' }),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };

  const controllers = {
    loginController: new LoginController(services.loginService),
    usersController: new UsersController(services.usersService),
    productosController: new ProductosController(services.productosService),
  };

  const database = { ping: jest.fn().mockResolvedValue(true) };
  const app = createApp({ controllers, database });

  return { app, services, database };
}

describe('API integration', () => {
  describe('GET /api/health', () => {
    it('responde 200 cuando la base de datos responde', async () => {
      const { app } = buildApp();

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ database: 'up' });
    });

    it('responde 503 cuando la base de datos falla', async () => {
      const { app, database } = buildApp();
      database.ping.mockRejectedValue(new Error('down'));

      const res = await request(app).get('/api/health');

      expect(res.status).toBe(503);
      expect(res.body.data).toEqual({ database: 'down' });
    });
  });

  describe('POST /api/login', () => {
    it('devuelve 400 cuando el cuerpo es inválido', async () => {
      const { app, services } = buildApp();

      const res = await request(app).post('/api/login').send({ email: 'no-es-email' });

      expect(res.status).toBe(400);
      expect(services.loginService.login).not.toHaveBeenCalled();
    });

    it('devuelve 200 y los tokens con credenciales válidas', async () => {
      const { app, services } = buildApp();

      const res = await request(app)
        .post('/api/login')
        .send({ email: 'pedro@ejemplo.cl', password: '321321' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ access_token: 'a', refresh_token: 'r' });
      expect(services.loginService.login).toHaveBeenCalledWith('pedro@ejemplo.cl', '321321');
    });
  });

  describe('rutas de usuarios', () => {
    it('GET /api/users sin token responde 401', async () => {
      const { app } = buildApp();

      const res = await request(app).get('/api/users');

      expect(res.status).toBe(401);
    });

    it('GET /api/users con token responde 200', async () => {
      const { app } = buildApp();

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${tokenFor('invitado')}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{ id: 1, username: 'pedro' }]);
    });

    it('propaga errores de dominio con su código (404)', async () => {
      const usersService = {
        list: jest.fn(),
        getById: jest.fn().mockRejectedValue(AppError.notFound('Usuario no encontrado.')),
      };
      const { app } = buildApp({ usersService });

      const res = await request(app)
        .get('/api/users/999')
        .set('Authorization', `Bearer ${tokenFor('admin')}`);

      expect(res.status).toBe(404);
    });

    it('POST /api/users responde 403 con rol no autorizado', async () => {
      const { app } = buildApp();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tokenFor('invitado')}`)
        .send({
          username: 'nuevo',
          nombre: 'N',
          apellido: 'A',
          rol: 'invitado',
          email: 'n@a.com',
          password: 'secret123',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/users responde 201 con admin y datos válidos', async () => {
      const { app, services } = buildApp();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${tokenFor('admin')}`)
        .send({
          username: 'nuevo',
          nombre: 'N',
          apellido: 'A',
          rol: 'invitado',
          email: 'n@a.com',
          password: 'secret123',
        });

      expect(res.status).toBe(201);
      expect(services.usersService.create).toHaveBeenCalled();
    });

    it('POST /api/register es público y responde 201', async () => {
      const { app } = buildApp();

      const res = await request(app).post('/api/register').send({
        username: 'nuevo',
        nombre: 'N',
        apellido: 'A',
        rol: 'invitado',
        email: 'n@a.com',
        password: 'secret123',
      });

      expect(res.status).toBe(201);
    });
  });

  describe('rutas de productos', () => {
    it('GET /api/productos es público y devuelve el listado paginado', async () => {
      const { app } = buildApp();

      const res = await request(app).get('/api/productos');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'success',
        data: [{ asin: 'A1' }],
        totProd: 1,
        page: 1,
        totPages: 1,
      });
    });

    it('GET /api/productos aplica la paginación validada por defecto', async () => {
      const { app, services } = buildApp();

      await request(app).get('/api/productos');

      expect(services.productosService.list).toHaveBeenCalledWith({
        search: undefined,
        page: 1,
        limit: 10,
      });
    });

    it('GET /api/productos propaga la página y la búsqueda solicitadas', async () => {
      const { app, services } = buildApp();

      const res = await request(app).get('/api/productos?search=zapatilla&page=3&limit=5');

      expect(res.status).toBe(200);
      expect(services.productosService.list).toHaveBeenCalledWith({
        search: 'zapatilla',
        page: 3,
        limit: 5,
      });
    });

    it('GET /api/productos responde 400 con una paginación inválida', async () => {
      const { app, services } = buildApp();

      const res = await request(app).get('/api/productos?page=0');

      expect(res.status).toBe(400);
      expect(services.productosService.list).not.toHaveBeenCalled();
    });

    it('POST /api/productos sin token es público y responde 201', async () => {
      const { app, services } = buildApp();

      const res = await request(app)
        .post('/api/productos')
        .field('asin', 'A1')
        .field('currency', 'USD')
        .field('product_price', '10')
        .field('product_title', 'Producto');

      expect(res.status).toBe(201);
      expect(services.productosService.create).toHaveBeenCalled();
    });

    it('POST /api/productos con datos inválidos responde 400', async () => {
      const { app, services } = buildApp();

      const res = await request(app).post('/api/productos').field('asin', 'A1');

      expect(res.status).toBe(400);
      expect(services.productosService.create).not.toHaveBeenCalled();
    });

    it('POST /api/productos con admin y datos válidos responde 201', async () => {
      const { app, services } = buildApp();

      const res = await request(app)
        .post('/api/productos')
        .set('Authorization', `Bearer ${tokenFor('admin')}`)
        .field('asin', 'A1')
        .field('currency', 'USD')
        .field('product_price', '10')
        .field('product_title', 'Producto');

      expect(res.status).toBe(201);
      expect(services.productosService.create).toHaveBeenCalled();
    });

    it('DELETE /api/productos/:id sin token es público y responde 200', async () => {
      const { app, services } = buildApp();

      const res = await request(app).delete('/api/productos/A1');

      expect(res.status).toBe(200);
      expect(services.productosService.remove).toHaveBeenCalledWith('A1');
    });

    it('DELETE /api/productos/:id con token también responde 200', async () => {
      const { app } = buildApp();

      const res = await request(app)
        .delete('/api/productos/A1')
        .set('Authorization', `Bearer ${tokenFor('admin')}`);

      expect(res.status).toBe(200);
    });
  });

  describe('rutas de autenticación', () => {
    it('POST /api/logout responde 200', async () => {
      const { app, services } = buildApp();

      const res = await request(app).post('/api/logout').send({ refreshToken: 'rt' });

      expect(res.status).toBe(200);
      expect(services.loginService.logout).toHaveBeenCalledWith('rt');
    });

    it('POST /api/refreshToken responde 200', async () => {
      const { app, services } = buildApp();

      const res = await request(app).post('/api/refreshToken').send({ refreshToken: 'rt' });

      expect(res.status).toBe(200);
      expect(services.loginService.refreshToken).toHaveBeenCalledWith('rt');
    });
  });

  describe('operaciones de actualización y borrado', () => {
    it('GET /api/productos/:id responde 200', async () => {
      const { app } = buildApp();

      const res = await request(app).get('/api/productos/A1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ asin: 'A1' });
    });

    it('PUT /api/productos/:id sin token es público y responde 200', async () => {
      const { app, services } = buildApp();

      const res = await request(app)
        .put('/api/productos/A1')
        .field('product_title', 'Nuevo titulo')
        .field('currency', 'USD')
        .field('product_price', '10');

      expect(res.status).toBe(200);
      expect(services.productosService.update).toHaveBeenCalled();
    });

    it('PUT /api/users/:id con admin responde 200', async () => {
      const { app, services } = buildApp();

      const res = await request(app)
        .put('/api/users/1')
        .set('Authorization', `Bearer ${tokenFor('admin')}`)
        .send({
          username: 'pedro',
          nombre: 'Pedro',
          apellido: 'Perez',
          rol: 'admin',
          email: 'pedro@ejemplo.cl',
        });

      expect(res.status).toBe(200);
      expect(services.usersService.update).toHaveBeenCalled();
    });

    it('DELETE /api/users/:id con admin responde 200', async () => {
      const { app, services } = buildApp();

      const res = await request(app)
        .delete('/api/users/1')
        .set('Authorization', `Bearer ${tokenFor('admin')}`);

      expect(res.status).toBe(200);
      expect(services.usersService.remove).toHaveBeenCalledWith('1');
    });
  });

  it('expone la documentación Swagger en /api/docs.json', async () => {
    const { app } = buildApp();

    const res = await request(app).get('/api/docs.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
  });
});
