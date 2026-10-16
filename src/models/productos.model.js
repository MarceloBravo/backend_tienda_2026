'use strict';

/**
 * Modelo de acceso a datos de productos. Solo ejecuta consultas SQL; la lógica
 * de negocio y el filtrado de campos viven en el servicio. La dependencia de
 * base de datos se inyecta por constructor (DIP).
 */
class ProductoModel {
  /**
   * @param {import('../db').Database} db Adaptador de base de datos inyectado.
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Lista productos con búsqueda opcional y paginación.
   *
   * @param {string|null} [search=null] Término de búsqueda.
   * @param {number} page Número de página (base 1).
   * @param {number} limit Tamaño de página.
   * @returns {Promise<object[]>} Lista de productos.
   * @throws {Error} Si la consulta falla.
   */
  async getAll(search = null, page, limit) {
    let query = 'SELECT * FROM productos';
    const params = [];
    const searchableFields = ['asin', 'product_title', 'product_badge', 'sales_volume'];

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
   * Obtiene un producto por su ASIN.
   *
   * @param {string} asin Identificador ASIN del producto.
   * @returns {Promise<object|undefined>} El producto o `undefined`.
   * @throws {Error} Si la consulta falla.
   */
  async getByAsin(asin) {
    const [rows] = await this.db.query('SELECT * FROM productos WHERE asin = ?', [asin]);
    return rows[0];
  }

  /**
   * Inserta un producto.
   *
   * @param {object} data Campos del producto a insertar.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la inserción.
   * @throws {Error} Si la inserción falla.
   */
  async create(data) {
    const [result] = await this.db.query('INSERT INTO productos SET ?', [data]);
    return result;
  }

  /**
   * Actualiza un producto por ASIN.
   *
   * @param {string} asin Identificador ASIN del producto.
   * @param {object} data Campos a actualizar.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la actualización.
   * @throws {Error} Si la actualización falla.
   */
  async update(asin, data) {
    const [result] = await this.db.query('UPDATE productos SET ? WHERE asin = ?', [data, asin]);
    return result;
  }

  /**
   * Elimina un producto por ASIN.
   *
   * @param {string} asin Identificador ASIN del producto.
   * @returns {Promise<import('mysql2').ResultSetHeader>} Resultado de la eliminación.
   * @throws {Error} Si la eliminación falla.
   */
  async remove(asin) {
    const [result] = await this.db.query('DELETE FROM productos WHERE asin = ?', [asin]);
    return result;
  }
}

module.exports = ProductoModel;
