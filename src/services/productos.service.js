'use strict';

const AppError = require('../errors/AppError');
const { buildProductPayload } = require('../dto/product.dto');
const { isDuplicateEntry } = require('../utils/dbErrors');

/**
 * Servicio de productos: aplica el filtrado de campos permitidos (whitelist),
 * las reglas de existencia y la recarga tras escritura, dejando al modelo como
 * simple repositorio de datos.
 */
class ProductosService {
  /**
   * @param {import('../models/productos.model')} productoModel Repositorio de productos.
   */
  constructor(productoModel) {
    this.productoModel = productoModel;
  }

  /**
   * Lista productos con búsqueda y paginación.
   *
   * @param {object} params Parámetros de consulta.
   * @param {string} [params.search] Término de búsqueda.
   * @param {number} params.page Número de página.
   * @param {number} params.limit Tamaño de página.
   * @returns {Promise<object[]>} Lista de productos.
   * @throws {Error} Si la consulta falla.
   */
  async list({ search, page, limit }) {
    return this.productoModel.getAll(search ?? null, page, limit);
  }

  /**
   * Obtiene un producto por ASIN o lanza un error 404.
   *
   * @param {string} asin Identificador ASIN del producto.
   * @returns {Promise<object>} Producto encontrado.
   * @throws {AppError} 404 si el producto no existe.
   */
  async getByAsin(asin) {
    const product = await this.productoModel.getByAsin(asin);
    if (!product) {
      throw AppError.notFound('Producto no encontrado.');
    }
    return product;
  }

  /**
   * Crea un producto filtrando los campos permitidos y devuelve el registro persistido.
   *
   * @param {object} body Datos crudos del producto.
   * @returns {Promise<object>} Producto creado.
   * @throws {AppError} 409 si el ASIN ya existe.
   */
  async create(body) {
    const payload = buildProductPayload(body);
    try {
      await this.productoModel.create(payload);
      return await this.getByAsin(payload.asin);
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /**
   * Actualiza un producto existente filtrando los campos permitidos.
   *
   * @param {string} asin Identificador ASIN del producto.
   * @param {object} body Datos crudos del producto.
   * @returns {Promise<object>} Producto actualizado.
   * @throws {AppError} 404 si el producto no existe.
   */
  async update(asin, body) {
    await this.getByAsin(asin);
    const payload = buildProductPayload(body);
    delete payload.asin;
    const result = await this.productoModel.update(asin, payload);
    if (result.affectedRows === 0) {
      throw AppError.notFound('Producto no encontrado.');
    }
    return this.getByAsin(asin);
  }

  /**
   * Elimina un producto existente.
   *
   * @param {string} asin Identificador ASIN del producto.
   * @returns {Promise<void>} Resolución cuando el producto se elimina.
   * @throws {AppError} 404 si el producto no existe.
   */
  async remove(asin) {
    const result = await this.productoModel.remove(asin);
    if (result.affectedRows === 0) {
      throw AppError.notFound('Producto no encontrado.');
    }
  }

  /**
   * Traduce errores de base de datos a errores de aplicación.
   *
   * @param {Error} error Error original.
   * @returns {Error} `AppError` de conflicto si el ASIN existe; el original en caso contrario.
   */
  translateError(error) {
    if (isDuplicateEntry(error)) {
      return AppError.conflict('El producto ya existe.');
    }
    return error;
  }
}

module.exports = ProductosService;
