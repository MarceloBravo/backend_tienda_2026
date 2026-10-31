'use strict';

const AppError = require('../errors/AppError');

/**
 * Estado inicial de una orden. Solo las órdenes en este estado pueden
 * reservar o liberar stock, lo que hace idempotente la liberación.
 *
 * @readonly
 * @type {string}
 */
const ESTADO_PENDIENTE = 'PENDIENTE';

/**
 * Modelo para gestión de órdenes.
 * Responsabilidad: Acceso a datos de ordenes y orden_detalle.
 *
 * @class OrdenesModel
 */
class OrdenesModel {
  /**
   * Crea una instancia del modelo de órdenes.
   *
   * @param {import('../db').Database} database Adaptador de base de datos inyectado.
   */
  constructor(database) {
    this.database = database;
  }

  /**
   * Crea una orden y su detalle en una transacción.
   *
   * @param {object} data Datos de la orden.
   * @param {number|null} data.usuarioId ID del usuario (opcional).
   * @param {string} data.buyOrder Código de orden único.
   * @param {string} data.sessionId ID de sesión.
   * @param {number} data.montoTotal Monto total.
   * @param {Array<object>} data.items Items de la orden.
   * @param {string|null} [data.direccionEnvio] Dirección de envío.
   * @returns {Promise<object>} Orden creada con sus detalles.
   * @throws {AppError} Si falla la creación.
   */
  async crearOrdenConDetalle({
    usuarioId,
    buyOrder,
    sessionId,
    montoTotal,
    items,
    direccionEnvio = null,
  }) {
    const connection = await this.database.getConnection();
    try {
      await connection.beginTransaction();

      const [ordenResult] = await connection.query(
        `INSERT INTO ordenes (usuario_id, buy_order, session_id, monto_total, estado, direccion_envio, metodo_pago)
         VALUES (?, ?, ?, ?, 'PENDIENTE', ?, 'WEBPAY')`,
        [usuarioId, buyOrder, sessionId, montoTotal, direccionEnvio],
      );

      const ordenId = ordenResult.insertId;

      await this.insertarDetalle(connection, ordenId, items);
      await this.reservarStock(connection, items);
      await connection.commit();

      return {
        id: ordenId,
        usuarioId,
        buyOrder,
        sessionId,
        montoTotal,
        estado: 'PENDIENTE',
        items,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Inserta el detalle de una orden en la conexión transaccional.
   *
   * @param {import('mysql2').PoolConnection} connection Conexión transaccional.
   * @param {number} ordenId ID de la orden.
   * @param {Array<object>} items Items de la orden.
   * @returns {Promise<void>}
   */
  async insertarDetalle(connection, ordenId, items) {
    if (!Array.isArray(items) || items.length === 0) {
      return;
    }

    const detalleValues = items.map((item) => [
      ordenId,
      item.productoId || null,
      item.asin || null,
      item.cantidad,
      item.precioUnitario,
      item.subtotal,
    ]);

    await connection.query(
      `INSERT INTO orden_detalle (orden_id, producto_id, asin, cantidad, precio_unitario, subtotal)
       VALUES ?`,
      [detalleValues],
    );
  }

  /**
   * Agrupa las cantidades por ASIN y las ordena alfabéticamente. Agrupar evita
   * actualizar dos veces el mismo producto y ordenar reduce el riesgo de
   * deadlocks entre transacciones concurrentes que bloquean las mismas filas.
   *
   * @param {Array<object>} [items=[]] Items con `asin`/`productoId` y `cantidad`.
   * @returns {Array<{asin: string, cantidad: number}>} Cantidades agrupadas y ordenadas.
   * @throws {AppError} Si algún item tiene una cantidad inválida.
   */
  agruparCantidadesPorAsin(items = []) {
    const cantidades = new Map();

    for (const item of items) {
      const asin = item.asin || item.productoId;
      if (!asin) {
        continue;
      }

      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw AppError.badRequest('Cantidad inválida en el carrito.');
      }

      cantidades.set(String(asin), (cantidades.get(String(asin)) || 0) + cantidad);
    }

    return [...cantidades.entries()]
      .map(([asin, cantidad]) => ({ asin, cantidad }))
      .sort((a, b) => a.asin.localeCompare(b.asin));
  }

  /**
   * Reserva el stock de los items dentro de la transacción de la orden. La
   * verificación y el descuento ocurren en una sola sentencia atómica para
   * evitar sobreventa entre peticiones concurrentes.
   *
   * @param {import('mysql2').PoolConnection} connection Conexión transaccional.
   * @param {Array<object>} items Items de la orden.
   * @returns {Promise<void>}
   * @throws {AppError} 400 si no hay stock suficiente para algún producto.
   */
  async reservarStock(connection, items) {
    const cantidades = this.agruparCantidadesPorAsin(items);

    for (const { asin, cantidad } of cantidades) {
      const [result] = await connection.query(
        'UPDATE productos SET stock = stock - ? WHERE asin = ? AND stock >= ?',
        [cantidad, asin, cantidad],
      );

      if (result.affectedRows !== 1) {
        throw AppError.badRequest(`Stock insuficiente para ${asin}.`);
      }
    }
  }

  /**
   * Libera el stock reservado por una orden y la deja en un estado terminal.
   * Solo actúa si la orden sigue en `PENDIENTE`, por lo que es idempotente ante
   * retornos duplicados de Transbank.
   *
   * @param {number} ordenId ID de la orden.
   * @param {'CANCELADO'|'RECHAZADO'} estadoFinal Estado terminal a aplicar.
   * @returns {Promise<{actualizada: boolean, estado: string|null}>} Indica si la
   *   transición se aplicó y el estado resultante de la orden.
   * @throws {Error} Si la transacción falla.
   */
  async liberarStockDeOrden(ordenId, estadoFinal) {
    const connection = await this.database.getConnection();

    try {
      await connection.beginTransaction();

      const [ordenes] = await connection.query(
        'SELECT estado FROM ordenes WHERE id = ? FOR UPDATE',
        [ordenId],
      );
      const orden = ordenes[0];

      if (!orden) {
        await connection.rollback();
        return { actualizada: false, estado: null };
      }

      if (orden.estado !== ESTADO_PENDIENTE) {
        await connection.rollback();
        return { actualizada: false, estado: orden.estado };
      }

      const [detalle] = await connection.query(
        'SELECT COALESCE(asin, producto_id) AS asin, cantidad FROM orden_detalle WHERE orden_id = ?',
        [ordenId],
      );
      const cantidades = this.agruparCantidadesPorAsin(detalle);

      for (const { asin, cantidad } of cantidades) {
        await connection.query('UPDATE productos SET stock = stock + ? WHERE asin = ?', [
          cantidad,
          asin,
        ]);
      }

      await connection.query('UPDATE ordenes SET estado = ? WHERE id = ?', [estadoFinal, ordenId]);
      await connection.commit();

      return { actualizada: true, estado: estadoFinal };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtiene una orden por su ID.
   *
   * @param {number} ordenId ID de la orden.
   * @returns {Promise<object|null>} Orden encontrada o null.
   */
  async obtenerPorId(ordenId) {
    const [rows] = await this.database.query(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM orden_detalle od WHERE od.orden_id = o.id) AS total_items
       FROM ordenes o
       WHERE o.id = ?`,
      [ordenId],
    );
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Obtiene una orden por buy_order.
   *
   * @param {string} buyOrder Código de orden.
   * @returns {Promise<object|null>} Orden encontrada o null.
   */
  async obtenerPorBuyOrder(buyOrder) {
    const [rows] = await this.database.query('SELECT * FROM ordenes WHERE buy_order = ?', [
      buyOrder,
    ]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Obtiene el detalle de una orden.
   *
   * @param {number} ordenId ID de la orden.
   * @returns {Promise<Array<object>>} Detalle de la orden.
   */
  async obtenerDetalle(ordenId) {
    const [rows] = await this.database.query(
      `SELECT od.*, p.product_title, p.product_photo
       FROM orden_detalle od
       LEFT JOIN productos p ON p.asin = od.asin OR p.asin = od.producto_id
       WHERE od.orden_id = ?`,
      [ordenId],
    );
    return rows || [];
  }

  /**
   * Actualiza el estado de una orden.
   *
   * @param {number} ordenId ID de la orden.
   * @param {string} estado Nuevo estado.
   * @returns {Promise<void>}
   */
  async actualizarEstado(ordenId, estado) {
    await this.database.query('UPDATE ordenes SET estado = ? WHERE id = ?', [estado, ordenId]);
  }
}

module.exports = OrdenesModel;
