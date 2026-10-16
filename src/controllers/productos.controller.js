'use strict';

const sendResponse = require('../utils/response');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Controlador de productos. Traduce HTTP ↔ servicio, incorpora el archivo subido
 * (`product_photo`) y aplica códigos de estado semánticos.
 */
class ProductosController {
  /**
   * @param {import('../services/productos.service')} productosService Servicio de productos.
   */
  constructor(productosService) {
    this.productosService = productosService;
  }

  /**
   * Lista productos con búsqueda y paginación.
   *
   * @param {import('express').Request} req Petición con `search`, `page` y `limit`.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con la lista de productos.
   * @throws {Error} Propagado al `errorHandler`.
   */
  async getAllProducts(req, res) {
    const { search, page, limit } = req.query;
    const products = await this.productosService.list({ search, page, limit });
    return sendResponse(res, { data: products });
  }

  /**
   * Obtiene un producto por su ASIN.
   *
   * @param {import('express').Request} req Petición con el parámetro `id` (ASIN).
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con el producto.
   * @throws {AppError} 404 propagado al `errorHandler` si no existe.
   */
  async getProductByAsin(req, res) {
    const product = await this.productosService.getByAsin(req.params.id);
    return sendResponse(res, { data: product });
  }

  /**
   * Crea un producto, incorporando la imagen subida si existe.
   *
   * @param {import('express').Request} req Petición con los datos del producto y `file` opcional.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta 201 con el producto creado.
   * @throws {AppError} 409 propagado al `errorHandler` si el ASIN ya existe.
   */
  async createProduct(req, res) {
    const payload = this.buildPayload(req);
    const product = await this.productosService.create(payload);
    return sendResponse(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Producto creado exitosamente.',
      data: product,
    });
  }

  /**
   * Actualiza un producto existente, incorporando la imagen subida si existe.
   *
   * @param {import('express').Request} req Petición con el parámetro `id`, datos y `file` opcional.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con el producto actualizado.
   * @throws {AppError} 404 propagado al `errorHandler` si no existe.
   */
  async updateProduct(req, res) {
    const payload = this.buildPayload(req);
    const product = await this.productosService.update(req.params.id, payload);
    return sendResponse(res, { message: 'Producto actualizado exitosamente.', data: product });
  }

  /**
   * Elimina un producto existente.
   *
   * @param {import('express').Request} req Petición con el parámetro `id` (ASIN).
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta de confirmación.
   * @throws {AppError} 404 propagado al `errorHandler` si no existe.
   */
  async deleteProduct(req, res) {
    await this.productosService.remove(req.params.id);
    return sendResponse(res, { message: 'Producto eliminado exitosamente.' });
  }

  /**
   * Combina el body con la ruta del archivo subido.
   *
   * @param {import('express').Request} req Petición con `body` y `file` opcional.
   * @returns {object} Payload del producto.
   */
  buildPayload(req) {
    return req.file ? { ...req.body, product_photo: req.file.path } : { ...req.body };
  }
}

module.exports = ProductosController;
