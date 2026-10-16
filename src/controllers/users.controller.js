'use strict';

const sendResponse = require('../utils/response');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Controlador de usuarios. Traduce HTTP ↔ servicio y aplica los códigos de
 * estado semánticos (201 en creación, 200 en el resto).
 */
class UsersController {
  /**
   * @param {import('../services/users.service')} usersService Servicio de usuarios.
   */
  constructor(usersService) {
    this.usersService = usersService;
  }

  /**
   * Lista usuarios con búsqueda y paginación.
   *
   * @param {import('express').Request} req Petición con `search`, `page` y `limit`.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con la lista de usuarios.
   * @throws {Error} Propagado al `errorHandler`.
   */
  async getAllUsers(req, res) {
    const { search, page, limit } = req.query;
    const users = await this.usersService.list({ search, page, limit });
    return sendResponse(res, { data: users });
  }

  /**
   * Obtiene un usuario por su identificador.
   *
   * @param {import('express').Request} req Petición con el parámetro `id`.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con el usuario.
   * @throws {AppError} 404 propagado al `errorHandler` si no existe.
   */
  async getUserById(req, res) {
    const user = await this.usersService.getById(req.params.id);
    return sendResponse(res, { data: user });
  }

  /**
   * Crea un usuario.
   *
   * @param {import('express').Request} req Petición con los datos del usuario en el body.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta 201 con el usuario creado.
   * @throws {AppError} 409 propagado al `errorHandler` si el username ya existe.
   */
  async createUser(req, res) {
    const user = await this.usersService.create(req.body);
    return sendResponse(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Usuario creado exitosamente.',
      data: user,
    });
  }

  /**
   * Actualiza un usuario existente.
   *
   * @param {import('express').Request} req Petición con el parámetro `id` y datos en el body.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con el usuario actualizado.
   * @throws {AppError} 404/409 propagados al `errorHandler`.
   */
  async updateUser(req, res) {
    const user = await this.usersService.update(req.params.id, req.body);
    return sendResponse(res, { message: 'Usuario actualizado exitosamente.', data: user });
  }

  /**
   * Elimina un usuario existente.
   *
   * @param {import('express').Request} req Petición con el parámetro `id`.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta de confirmación.
   * @throws {AppError} 404 propagado al `errorHandler` si no existe.
   */
  async deleteUser(req, res) {
    await this.usersService.remove(req.params.id);
    return sendResponse(res, { message: 'Usuario eliminado exitosamente.' });
  }
}

module.exports = UsersController;
