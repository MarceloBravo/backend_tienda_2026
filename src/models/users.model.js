'use strict';

/**
 * Modelo de acceso a datos de usuarios. Solo ejecuta consultas SQL; la lógica
 * de negocio (hashing, reglas, recarga tras escritura) vive en el servicio.
 * La dependencia de base de datos se inyecta por constructor (DIP).
 */
class UsersModel {
  /**
   * @param {import('../db').Database} db Adaptador de base de datos inyectado.
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Lista usuarios con búsqueda opcional y paginación.
   *
   * @param {string|null} [search=null] Término de búsqueda.
   * @param {number} page Número de página (base 1).
   * @param {number} limit Tamaño de página.
   * @returns {Promise<object[]>} Lista de usuarios sin campos sensibles.
   * @throws {Error} Si la consulta falla.
   */
  async getAll(search = null, page, limit) {
    let query = 'SELECT id, username, nombre, apellido, rol, email, created_at FROM users';
    const params = [];
    const searchableFields = ['username', 'nombre', 'apellido', 'rol', 'email'];

    if (search && search.trim().length > 0) {
      const conditions = searchableFields.map((field) => `${field} LIKE ?`);
      query += ' WHERE ' + conditions.join(' OR ');
      params.push(...Array(searchableFields.length).fill(`%${search}%`));
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    const [rows] = await this.db.query(query, params);
    return rows;
  }

  /**
   * Obtiene un usuario por su identificador.
   *
   * @param {number|string} id Identificador del usuario.
   * @returns {Promise<object|undefined>} El usuario o `undefined` si no existe.
   * @throws {Error} Si la consulta falla.
   */
  async getById(id) {
    const [rows] = await this.db.query(
      'SELECT id, username, nombre, apellido, rol, email, created_at FROM users WHERE id = ?',
      [id],
    );
    return rows[0];
  }

  /**
   * Busca un usuario por email incluyendo el password (uso interno de autenticación).
   *
   * @param {string} email Email del usuario.
   * @returns {Promise<object|undefined>} El usuario completo o `undefined`.
   * @throws {Error} Si la consulta falla.
   */
  async findByEmail(email) {
    const [rows] = await this.db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  /**
   * Inserta un usuario. El password debe llegar ya hasheado.
   *
   * @param {object} data Datos del usuario (password hasheado).
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la inserción.
   * @throws {Error} Si la inserción falla (p. ej. usuario duplicado).
   */
  async create(data) {
    const { username, nombre, apellido, rol, email, password } = data;
    const [result] = await this.db.query(
      'INSERT INTO users (username, nombre, apellido, rol, email, password) VALUES (?, ?, ?, ?, ?, ?)',
      [username, nombre, apellido, rol, email, password],
    );
    return result;
  }

  /**
   * Actualiza los datos básicos de un usuario.
   *
   * @param {number|string} id Identificador del usuario.
   * @param {object} data Campos a actualizar.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la actualización.
   * @throws {Error} Si la actualización falla.
   */
  async update(id, data) {
    const { username, nombre, apellido, rol, email } = data;
    const [result] = await this.db.query(
      'UPDATE users SET username = ?, nombre = ?, apellido = ?, rol = ?, email = ? WHERE id = ?',
      [username, nombre, apellido, rol, email, id],
    );
    return result;
  }

  /**
   * Actualiza el password hasheado de un usuario.
   *
   * @param {number|string} id Identificador del usuario.
   * @param {string} hashedPassword Password ya hasheado.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la actualización.
   * @throws {Error} Si la actualización falla.
   */
  async updatePassword(id, hashedPassword) {
    const [result] = await this.db.query('UPDATE users SET password = ? WHERE id = ?', [
      hashedPassword,
      id,
    ]);
    return result;
  }

  /**
   * Elimina un usuario por su identificador.
   *
   * @param {number|string} id Identificador del usuario.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la eliminación.
   * @throws {Error} Si la eliminación falla.
   */
  async remove(id) {
    const [result] = await this.db.query('DELETE FROM users WHERE id = ?', [id]);
    return result;
  }

  /**
   * Actualiza el refresh token de un usuario.
   *
   * @param {number|string} id Identificador del usuario.
   * @param {string} refreshToken Nuevo refresh token.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la actualización.
   * @throws {Error} Si la actualización falla.
   */
  async updateRefreshToken(id, refreshToken) {
    const [result] = await this.db.query('UPDATE users SET refresh_token = ? WHERE id = ?', [
      refreshToken,
      id,
    ]);
    return result;
  }

  /**
   * Busca un usuario por id y refresh token (validación de sesión).
   *
   * @param {number|string} id Identificador del usuario.
   * @param {string} refreshToken Refresh token almacenado.
   * @returns {Promise<object|undefined>} El usuario o `undefined`.
   * @throws {Error} Si la consulta falla.
   */
  async findByRefreshToken(id, refreshToken) {
    const [rows] = await this.db.query('SELECT * FROM users WHERE id = ? AND refresh_token = ?', [
      id,
      refreshToken,
    ]);
    return rows[0];
  }

  /**
   * Invalida el refresh token de un usuario (cierre de sesión).
   *
   * @param {number|string} id Identificador del usuario.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la actualización.
   * @throws {Error} Si la actualización falla.
   */
  async clearRefreshToken(id) {
    const [result] = await this.db.query('UPDATE users SET refresh_token = NULL WHERE id = ?', [
      id,
    ]);
    return result;
  }
}

module.exports = UsersModel;
