'use strict';

const bcrypt = require('bcrypt');
const AppError = require('../errors/AppError');
const { buildUserPayload } = require('../dto/user.dto');
const { isDuplicateEntry } = require('../utils/dbErrors');

const SALT_ROUNDS = Number(process.env.SALTROUND) || 10;

/**
 * Servicio de usuarios: concentra la lógica de negocio (hashing de contraseñas,
 * reglas de existencia, traducción de errores de base de datos) manteniendo los
 * modelos como simples repositorios de datos.
 */
class UsersService {
  /**
   * @param {import('../models/users.model')} usersModel Repositorio de usuarios.
   */
  constructor(usersModel) {
    this.usersModel = usersModel;
  }

  /**
   * Lista usuarios con soporte de búsqueda y paginación.
   *
   * @param {object} params Parámetros de consulta.
   * @param {string} [params.search] Término de búsqueda.
   * @param {number} params.page Número de página.
   * @param {number} params.limit Tamaño de página.
   * @returns {Promise<object[]>} Lista de usuarios.
   * @throws {Error} Si la consulta falla.
   */
  async list({ search, page, limit }) {
    return this.usersModel.getAll(search ?? null, page, limit);
  }

  /**
   * Obtiene un usuario por id o lanza un error 404.
   *
   * @param {number|string} id Identificador del usuario.
   * @returns {Promise<object>} Usuario encontrado.
   * @throws {AppError} 404 si el usuario no existe.
   */
  async getById(id) {
    const user = await this.usersModel.getById(id);
    if (!user) {
      throw AppError.notFound('Usuario no encontrado.');
    }
    return user;
  }

  /**
   * Crea un usuario, hasheando su contraseña y traduciendo duplicados.
   *
   * @param {object} body Datos crudos del usuario.
   * @returns {Promise<object>} Usuario creado.
   * @throws {AppError} 409 si el username ya existe.
   */
  async create(body) {
    const payload = buildUserPayload(body);
    payload.password = await this.hashPassword(payload.password);
    try {
      const result = await this.usersModel.create(payload);
      return await this.getById(result.insertId);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /**
   * Actualiza un usuario y, si corresponde, su contraseña.
   *
   * @param {number|string} id Identificador del usuario.
   * @param {object} body Datos crudos del usuario.
   * @returns {Promise<object>} Usuario actualizado.
   * @throws {AppError} 404 si no existe; 409 si el username ya está tomado.
   */
  async update(id, body) {
    await this.getById(id);
    const payload = buildUserPayload(body);
    const { password } = payload;
    delete payload.password;
    try {
      await this.usersModel.update(id, payload);
    } catch (error) {
      throw this.translateError(error);
    }
    if (password && password.trim().length > 0) {
      await this.usersModel.updatePassword(id, await this.hashPassword(password));
    }
    return this.getById(id);
  }

  /**
   * Elimina un usuario existente.
   *
   * @param {number|string} id Identificador del usuario.
   * @returns {Promise<void>} Resolución cuando el usuario se elimina.
   * @throws {AppError} 404 si el usuario no existe.
   */
  async remove(id) {
    await this.getById(id);
    const result = await this.usersModel.remove(id);
    if (result.affectedRows === 0) {
      throw AppError.notFound('Usuario no encontrado.');
    }
  }

  /**
   * Genera el hash de una contraseña en texto plano.
   *
   * @param {string} plainPassword Contraseña en texto plano.
   * @returns {Promise<string>} Contraseña hasheada.
   * @throws {Error} Si el hashing falla.
   */
  async hashPassword(plainPassword) {
    return bcrypt.hash(String(plainPassword), SALT_ROUNDS);
  }

  /**
   * Traduce errores de base de datos a errores de aplicación.
   *
   * @param {Error} error Error original.
   * @returns {Error} `AppError` de conflicto si es duplicado; el original en caso contrario.
   */
  translateError(error) {
    if (isDuplicateEntry(error)) {
      return AppError.conflict('El nombre de usuario ya está registrado.');
    }
    return error;
  }
}

module.exports = UsersService;
