'use strict';

/**
 * Modelo para gestión de pagos Transbank.
 * Responsabilidad: Acceso a datos de pagos_transbank.
 *
 * @class PagosModel
 */
class PagosModel {
  /**
   * Crea una instancia del modelo de pagos.
   *
   * @param {import('../db').Database} database Adaptador de base de datos inyectado.
   */
  constructor(database) {
    this.database = database;
  }

  /**
   * Crea o actualiza un registro de pago al iniciar transacción.
   *
   * @param {object} data Datos del pago.
   * @param {number} data.ordenId ID de la orden.
   * @param {string} data.tokenWs Token de Webpay.
   * @param {string} data.buyOrder Código de orden.
   * @param {string} data.sessionId ID de sesión.
   * @param {number} data.amount Monto.
   * @returns {Promise<void>}
   */
  async crearOActualizarAlIniciar({ ordenId, tokenWs, buyOrder, sessionId, amount }) {
    const [existing] = await this.database.query(
      'SELECT id FROM pagos_transbank WHERE orden_id = ?',
      [ordenId],
    );
    if (existing && existing.length > 0) {
      await this.database.query(
        `UPDATE pagos_transbank SET token_ws = ?, buy_order = ?, session_id = ?, amount = ?, status = 'INICIADO', updated_at = CURRENT_TIMESTAMP WHERE orden_id = ?`,
        [tokenWs, buyOrder, sessionId, amount, ordenId],
      );
      return;
    }

    await this.database.query(
      `INSERT INTO pagos_transbank (orden_id, token_ws, buy_order, session_id, amount, status)
       VALUES (?, ?, ?, ?, ?, 'INICIADO')`,
      [ordenId, tokenWs, buyOrder, sessionId, amount],
    );
  }

  /**
   * Obtiene un pago por token_ws.
   *
   * @param {string} tokenWs Token de Webpay.
   * @returns {Promise<object|null>} Pago encontrado o null.
   */
  async obtenerPorToken(tokenWs) {
    const [rows] = await this.database.query('SELECT * FROM pagos_transbank WHERE token_ws = ?', [
      tokenWs,
    ]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Obtiene un pago por orden_id.
   *
   * @param {number} ordenId ID de la orden.
   * @returns {Promise<object|null>} Pago encontrado o null.
   */
  async obtenerPorOrdenId(ordenId) {
    const [rows] = await this.database.query('SELECT * FROM pagos_transbank WHERE orden_id = ?', [
      ordenId,
    ]);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  }

  /**
   * Actualiza el pago con la respuesta de commit.
   *
   * @param {number} ordenId ID de la orden.
   * @param {object} commitResponse Respuesta de Transbank.
   * @returns {Promise<void>}
   */
  async actualizarConCommit(ordenId, commitResponse) {
    const response = commitResponse || {};
    const {
      response_code: responseCode,
      authorization_code: authorizationCode,
      payment_type_code: paymentTypeCode,
      installments_number: installmentsNumber,
      card_detail: cardDetail,
      vci,
      transaction_date: transactionDate,
    } = response;

    const estado = this.determinarEstado(response);

    await this.database.query(
      `UPDATE pagos_transbank 
       SET status = ?, response_code = ?, authorization_code = ?, payment_type_code = ?, 
           installments_number = ?, card_detail = ?, vci = ?, transaction_date = ?, 
           raw_response = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE orden_id = ?`,
      [
        estado,
        responseCode ?? null,
        authorizationCode || null,
        paymentTypeCode || null,
        installmentsNumber ?? null,
        cardDetail ? JSON.stringify(cardDetail) : null,
        vci || null,
        transactionDate || null,
        JSON.stringify(response),
        ordenId,
      ],
    );
  }

  /**
   * Actualiza únicamente el estado de un pago.
   *
   * @param {number} ordenId ID de la orden.
   * @param {string} status Nuevo estado (`INICIADO`, `AUTORIZADO`, `RECHAZADO`, `TIMEOUT`, `ERROR`).
   * @returns {Promise<void>}
   */
  async actualizarEstado(ordenId, status) {
    await this.database.query('UPDATE pagos_transbank SET status = ? WHERE orden_id = ?', [
      status,
      ordenId,
    ]);
  }

  /**
   * Determina el estado interno a partir de la respuesta de Transbank.
   *
   * @param {object} response Respuesta de `commit`.
   * @returns {string} Estado del pago (`AUTORIZADO`, `RECHAZADO` o `INICIADO`).
   */
  determinarEstado(response) {
    if (response.status === 'AUTHORIZED' || response.response_code === 0) {
      return 'AUTORIZADO';
    }
    if (response.status === 'FAILED') {
      return 'RECHAZADO';
    }
    if (
      response.response_code !== undefined &&
      response.response_code !== null &&
      response.response_code !== 0
    ) {
      return 'RECHAZADO';
    }
    return 'INICIADO';
  }
}

module.exports = PagosModel;
