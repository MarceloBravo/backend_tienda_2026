'use strict';

const { randomUUID } = require('crypto');
const AppError = require('../errors/AppError');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Servicio de órdenes.
 * Lógica de negocio para crear órdenes y calcular totales.
 *
 * @class OrdenesService
 */
class OrdenesService {
  /**
   * Crea una instancia del servicio de órdenes.
   *
   * @param {import('../models/ordenes.model')} ordenesModel Modelo de órdenes.
   * @param {import('../models/productos.model')} productosModel Modelo de productos.
   */
  constructor(ordenesModel, productosModel) {
    this.ordenesModel = ordenesModel;
    this.productosModel = productosModel;
  }

  /**
   * Genera un buy_order único.
   *
   * @returns {string} Buy order generado.
   */
  generarBuyOrder() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const uuid = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `ORD-${timestamp}-${uuid}`;
  }

  /**
   * Genera un session_id.
   *
   * @param {number|null} usuarioId ID del usuario.
   * @returns {string} Session ID.
   */
  generarSessionId(usuarioId) {
    const uuid = randomUUID().replace(/-/g, '');
    return usuarioId ? `USER-${usuarioId}-${uuid}` : `GUEST-${uuid}`;
  }

  /**
   * Crea una orden desde el carrito.
   *
   * @param {object} data Datos para crear orden.
   * @param {number|null} data.usuarioId ID del usuario.
   * @param {Array<object>} data.items Items del carrito.
   * @param {string|null} [data.direccionEnvio] Dirección de envío.
   * @returns {Promise<object>} Orden creada.
   * @throws {AppError} Si hay errores de validación.
   */
  async crearOrden({ usuarioId, items, direccionEnvio = null }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('El carrito está vacío.', HTTP_STATUS.BAD_REQUEST);
    }

    const itemsValidados = [];
    let montoTotal = 0;

    for (let i = 0; i < items.length; i += 1) {
      const itemValidado = await this.validarItem(items[i]);
      montoTotal += itemValidado.subtotal;
      itemsValidados.push(itemValidado);
    }

    const orden = await this.ordenesModel.crearOrdenConDetalle({
      usuarioId,
      buyOrder: this.generarBuyOrder(),
      sessionId: this.generarSessionId(usuarioId),
      montoTotal: Math.round(montoTotal),
      items: itemsValidados,
      direccionEnvio,
    });

    return {
      ordenId: orden.id,
      buyOrder: orden.buyOrder,
      sessionId: orden.sessionId,
      montoTotal: orden.montoTotal,
      estado: orden.estado,
      items: itemsValidados,
    };
  }

  /**
   * Valida un item del carrito y calcula su subtotal desde el precio en BD.
   *
   * @param {object} item Item del carrito (`asin`/`productoId` y `cantidad`).
   * @returns {Promise<object>} Item validado con precio y subtotal congelados.
   * @throws {AppError} Si la cantidad, el producto o el stock son inválidos.
   */
  async validarItem(item) {
    const cantidad = Number(item.cantidad);
    if (!cantidad || cantidad <= 0) {
      throw new AppError('Cantidad inválida en el carrito.', HTTP_STATUS.BAD_REQUEST);
    }

    const asin = item.asin || item.productoId;
    if (!asin) {
      throw new AppError('Producto inválido en el carrito.', HTTP_STATUS.BAD_REQUEST);
    }

    const producto = await this.productosModel.getByAsin(asin);
    if (!producto) {
      throw new AppError(`Producto ${asin} no encontrado.`, HTTP_STATUS.NOT_FOUND);
    }

    if (producto.stock !== undefined && producto.stock < cantidad) {
      throw new AppError(
        `Stock insuficiente para ${producto.product_title || asin}.`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const precioUnitario = Number(producto.product_price);
    return {
      productoId: producto.asin,
      asin: producto.asin,
      cantidad,
      precioUnitario,
      subtotal: Math.round(precioUnitario * cantidad),
    };
  }

  /**
   * Obtiene una orden por ID.
   *
   * @param {number} ordenId ID de la orden.
   * @returns {Promise<object>} Orden encontrada.
   * @throws {AppError} Si no existe.
   */
  async obtenerOrden(ordenId) {
    const orden = await this.ordenesModel.obtenerPorId(ordenId);
    if (!orden) {
      throw new AppError('Orden no encontrada.', HTTP_STATUS.NOT_FOUND);
    }
    const detalle = await this.ordenesModel.obtenerDetalle(ordenId);
    return { ...orden, detalle };
  }

  /**
   * Valida que una orden pertenezca a un usuario.
   *
   * @param {number} ordenId ID de la orden.
   * @param {number|null} usuarioId ID del usuario.
   * @returns {Promise<object>} Orden validada.
   * @throws {AppError} Si no pertenece o no existe.
   */
  async validarPertenencia(ordenId, usuarioId) {
    const orden = await this.obtenerOrden(ordenId);
    if (orden.usuario_id !== null && orden.usuario_id !== undefined) {
      if (Number(orden.usuario_id) !== Number(usuarioId)) {
        throw new AppError('No autorizado para operar sobre esta orden.', HTTP_STATUS.FORBIDDEN);
      }
    }
    return orden;
  }

  /**
   * Actualiza estado de orden.
   *
   * @param {number} ordenId ID de la orden.
   * @param {string} estado Nuevo estado.
   * @returns {Promise<void>}
   */
  async actualizarEstado(ordenId, estado) {
    await this.ordenesModel.actualizarEstado(ordenId, estado);
  }
}

module.exports = OrdenesService;
