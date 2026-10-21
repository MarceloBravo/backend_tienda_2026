'use strict';

/**
 * Campos por los que se puede filtrar el listado de productos.
 *
 * @readonly
 * @type {string[]}
 */
const SEARCHABLE_FIELDS = Object.freeze(['asin', 'product_title', 'product_badge', 'sales_volume']);

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
   * @returns {Promise<object[]>} Lista de productos de la página solicitada.
   * @throws {Error} Si la consulta falla.
   */
  async getAll(search = null, page, limit) {
    const { clause, params } = this.buildSearchFilter(search);
    const query = `SELECT * FROM productos${clause} LIMIT ? OFFSET ?`;
    params.push(limit, (page - 1) * limit);
    const [rows] = await this.db.query(query, params);
    return rows;
  }

  /**
   * Cuenta el total de productos que cumplen el filtro de búsqueda (sin paginar).
   *
   * @param {string|null} [search=null] Término de búsqueda.
   * @returns {Promise<number>} Cantidad total de productos encontrados.
   * @throws {Error} Si la consulta falla.
   */
  async getCountAll(search = null) {
    const { clause, params } = this.buildSearchFilter(search);
    const query = `SELECT COUNT(*) AS total FROM productos${clause}`;
    const [rows] = await this.db.query(query, params);
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Construye la cláusula de filtro por búsqueda y sus parámetros. Es la única
   * fuente de verdad del filtro, reutilizada por el listado y el conteo (DRY).
   *
   * @param {string|null} [search=null] Término de búsqueda.
   * @returns {{ clause: string, params: string[] }} Cláusula `WHERE` (cadena vacía
   *   si no hay búsqueda) y los parámetros asociados.
   */
  buildSearchFilter(search = null) {
    if (!search || search.trim().length === 0) {
      return { clause: '', params: [] };
    }
    const conditions = SEARCHABLE_FIELDS.map((field) => `${field} LIKE ?`);
    const params = Array(SEARCHABLE_FIELDS.length).fill(`%${search}%`);
    return { clause: ` WHERE ${conditions.join(' OR ')}`, params };
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
