'use strict';

const UsersModel = require('./models/users.model');
const ProductoModel = require('./models/productos.model');
const LoginService = require('./services/login.service');
const UsersService = require('./services/users.service');
const ProductosService = require('./services/productos.service');
const LoginController = require('./controllers/login.controller');
const UsersController = require('./controllers/users.controller');
const ProductosController = require('./controllers/productos.controller');

/**
 * Composition root: construye el grafo de dependencias (modelos → servicios →
 * controladores) inyectando el adaptador de base de datos. Aplicar **DIP**:
 * las capas superiores dependen de abstracciones inyectadas, no de `mysql2`.
 *
 * @param {import('./db').Database} database Adaptador de base de datos.
 * @returns {object} Controladores listos para montar en las rutas.
 */
function createContainer(database) {
  const usersModel = new UsersModel(database);
  const productoModel = new ProductoModel(database);

  return {
    loginController: new LoginController(new LoginService(usersModel)),
    usersController: new UsersController(new UsersService(usersModel)),
    productosController: new ProductosController(new ProductosService(productoModel)),
  };
}

module.exports = { createContainer };
