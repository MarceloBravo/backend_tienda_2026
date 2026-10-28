'use strict';

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
