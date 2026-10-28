'use strict';

const { getWebpayTransaction, getReturnUrl } = require('../config/transbank');
const AppError = require('../errors/AppError');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Servicio de Transbank Webpay Plus.
 * Encapsula las llamadas al SDK y mantiene sincronizados orden y pago.
 *
 * @class TransbankService
 */
class TransbankService {
  /**
   * @param {import('../models/ordenes.model')} ordenesModel Modelo de órdenes.
   * @param {import('../models/pagos.model')} pagosModel Modelo de pagos.
   */
  constructor(ordenesModel, pagosModel) {
    this.ordenesModel = ordenesModel;
    this.pagosModel = pagosModel;
    this.transaction = getWebpayTransaction();
  }

  /**
   * Inicia una transacción con Webpay Plus.
   *
   * @param {object} orden Datos de la orden.
   * @param {number} orden.id ID de la orden.
   * @param {string} orden.buy_order Buy order.
   * @param {string} orden.session_id Session ID.
   * @param {number} orden.monto_total Monto total.
   * @returns {Promise<object>} Respuesta con `url` y `token`.
   * @throws {AppError} Si los datos son inválidos o Transbank falla.
   */
  async iniciarTransaccion(orden) {
    try {
      const datos = this.normalizarDatosOrden(orden);
      const response = await this.transaction.create(
        datos.buyOrder,
        datos.sessionId,
        datos.amount,
        getReturnUrl(),
      );
      this.validarRespuestaCreacion(response);

      await this.pagosModel.crearOActualizarAlIniciar({
        ordenId: orden.id,
        tokenWs: response.token,
        buyOrder: datos.buyOrder,
        sessionId: datos.sessionId,
        amount: datos.amount,
      });

      return {
        url: response.url,
        token: response.token,
        buyOrder: datos.buyOrder,
        amount: datos.amount,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Error al iniciar transacción con Transbank.', HTTP_STATUS.BAD_GATEWAY);
    }
  }

  /**
   * Confirma una transacción con Webpay Plus.
   *
   * @param {string} tokenWs Token de la transacción.
   * @returns {Promise<object>} Resultado de la confirmación.
   * @throws {AppError} Si falla.
   */
  async confirmarTransaccion(tokenWs) {
    try {
      if (!tokenWs) {
        throw new AppError('Token de transacción requerido.', HTTP_STATUS.BAD_REQUEST);
      }

      const pago = await this.pagosModel.obtenerPorToken(tokenWs);
      if (!pago) {
        throw new AppError('Transacción no encontrada.', HTTP_STATUS.NOT_FOUND);
      }

      if (pago.status === 'AUTORIZADO' || pago.status === 'RECHAZADO') {
        return this.construirResultadoYaProcesado(pago);
      }

      return await this.procesarCommit(tokenWs, pago);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error al confirmar transacción con Transbank.', HTTP_STATUS.BAD_GATEWAY);
    }
  }

  /**
   * Marca una transacción como cancelada por el usuario (retorno sin `token_ws`).
   *
   * @param {string} tokenWs Token de la transacción cancelada.
   * @returns {Promise<object>} Resultado de la cancelación.
   * @throws {AppError} Si falta el token.
   */
  async cancelarTransaccion(tokenWs) {
    if (!tokenWs) {
      throw new AppError('Token de transacción requerido.', HTTP_STATUS.BAD_REQUEST);
    }

    const pago = await this.pagosModel.obtenerPorToken(tokenWs);
    if (pago) {
      await this.pagosModel.actualizarEstado(pago.orden_id, 'ERROR');
      await this.ordenesModel.actualizarEstado(pago.orden_id, 'CANCELADO');
    }

    return {
      autorizado: false,
      cancelado: true,
      yaProcesado: Boolean(pago),
      ordenId: pago?.orden_id || null,
      buyOrder: pago?.buy_order || null,
      monto: pago?.amount || null,
    };
  }

  /**
   * Normaliza y valida los datos mínimos de una orden.
   *
   * @param {object} orden Orden a procesar.
   * @returns {{ buyOrder: string, sessionId: string, amount: number }} Datos normalizados.
   * @throws {AppError} Si faltan datos obligatorios.
   */
  normalizarDatosOrden(orden) {
    const buyOrder = orden.buy_order || orden.buyOrder;
    const sessionId = orden.session_id || orden.sessionId;
    const amount = Math.round(Number(orden.monto_total || orden.montoTotal));

    if (!buyOrder || !sessionId || !amount) {
      throw new AppError('Datos de orden incompletos para iniciar pago.', HTTP_STATUS.BAD_REQUEST);
    }

    return { buyOrder, sessionId, amount };
  }

  /**
   * Valida la respuesta de creación de transacción del SDK.
   *
   * @param {object} response Respuesta de `create`.
   * @returns {void}
   * @throws {AppError} Si la respuesta no trae `token`/`url`.
   */
  validarRespuestaCreacion(response) {
    if (!response || !response.token || !response.url) {
      throw new AppError(
        'No se pudo iniciar la transacción con Transbank.',
        HTTP_STATUS.BAD_GATEWAY,
      );
    }
  }

  /**
   * Ejecuta el commit y actualiza la orden/pago según el resultado.
   *
   * @param {string} tokenWs Token de la transacción.
   * @param {object} pago Registro de pago existente.
   * @returns {Promise<object>} Resultado de la confirmación.
   */
  async procesarCommit(tokenWs, pago) {
    let response;
    try {
      response = await this.transaction.commit(tokenWs);
    } catch (_commitError) {
      return this.construirResultadoYaProcesado(pago);
    }

    await this.pagosModel.actualizarConCommit(pago.orden_id, response);

    const autorizado = this.esAutorizado(response);
    await this.ordenesModel.actualizarEstado(pago.orden_id, autorizado ? 'PAGADO' : 'RECHAZADO');

    const orden = await this.ordenesModel.obtenerPorId(pago.orden_id);
    const pagoActualizado = await this.pagosModel.obtenerPorOrdenId(pago.orden_id);

    return this.construirResultadoConfirmacion({
      response,
      pago,
      autorizado,
      orden,
      pagoActualizado,
    });
  }

  /**
   * Determina si la respuesta de commit corresponde a una transacción autorizada.
   *
   * @param {object} response Respuesta de `commit`.
   * @returns {boolean} `true` si fue autorizada.
   */
  esAutorizado(response) {
    if (!response) return false;
    return response.status === 'AUTHORIZED' || response.response_code === 0;
  }

  /**
   * Construye el resultado de una confirmación exitosa.
   *
   * @param {object} datos Datos del resultado.
   * @param {object} datos.response Respuesta de Transbank.
   * @param {object} datos.pago Pago original.
   * @param {boolean} datos.autorizado Indica si fue autorizado.
   * @param {object} datos.orden Orden actualizada.
   * @param {object} datos.pagoActualizado Pago actualizado.
   * @returns {object} Resultado de la confirmación.
   */
  construirResultadoConfirmacion({ response, pago, autorizado, orden, pagoActualizado }) {
    return {
      autorizado,
      yaProcesado: false,
      ordenId: pago.orden_id,
      buyOrder: response.buy_order || pago.buy_order,
      monto: response.amount || pago.amount,
      responseCode: response.response_code,
      authorizationCode: response.authorization_code,
      paymentTypeCode: response.payment_type_code,
      installmentsNumber: response.installments_number,
      cardDetail: response.card_detail,
      vci: response.vci,
      transactionDate: response.transaction_date,
      orden,
      pago: pagoActualizado,
      rawResponse: response,
    };
  }

  /**
   * Construye el resultado para una transacción ya procesada (idempotencia).
   *
   * @param {object} pago Registro de pago.
   * @returns {Promise<object>} Resultado con `yaProcesado: true`.
   */
  async construirResultadoYaProcesado(pago) {
    const orden = await this.ordenesModel.obtenerPorId(pago.orden_id);
    const pagoActualizado = await this.pagosModel.obtenerPorOrdenId(pago.orden_id);
    const pagoFinal = pagoActualizado || pago;

    return {
      autorizado: pagoFinal.status === 'AUTORIZADO',
      yaProcesado: true,
      ordenId: pago.orden_id,
      buyOrder: pago.buy_order,
      monto: pago.amount,
      orden,
      pago: pagoFinal,
    };
  }
}

module.exports = TransbankService;
