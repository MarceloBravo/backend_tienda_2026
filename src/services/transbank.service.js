'use strict';

const { getWebpayTransaction, getReturnUrl } = require('../config/transbank');
const AppError = require('../errors/AppError');
const { HTTP_STATUS } = require('../config/constants');
const { generarBuyOrderIntento } = require('../utils/buyOrder');
const { ESTADOS_PAGO, esTransaccionAutorizada } = require('../utils/transbank');
const logger = require('../utils/logger');

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
   * Cada intento usa un `buy_order` derivado y único para no reutilizar el de
   * la orden ni el de un intento anterior.
   *
   * @param {object} orden Datos de la orden.
   * @param {number} orden.id ID de la orden.
   * @param {string} orden.buy_order Buy order estable de la orden.
   * @param {string} orden.session_id Session ID.
   * @param {number} orden.monto_total Monto total.
   * @returns {Promise<object>} Respuesta con `url`, `token`, `buyOrder` y `amount`.
   * @throws {AppError} Si los datos son inválidos o Transbank falla.
   */
  async iniciarTransaccion(orden) {
    try {
      const datos = this.normalizarDatosOrden(orden);
      const buyOrderIntento = generarBuyOrderIntento(datos.buyOrder);

      const response = await this.transaction.create(
        buyOrderIntento,
        datos.sessionId,
        datos.amount,
        getReturnUrl(),
      );
      this.validarRespuestaCreacion(response);

      await this.pagosModel.crearOActualizarAlIniciar({
        ordenId: orden.id,
        tokenWs: response.token,
        buyOrder: buyOrderIntento,
        sessionId: datos.sessionId,
        amount: datos.amount,
      });

      return {
        url: response.url,
        token: response.token,
        buyOrder: buyOrderIntento,
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
   * Confirma una transacción con Webpay Plus. Si el pago ya fue rechazado,
   * reintenta la liberación de stock (idempotente) para recuperar un fallo
   * previo en esa transacción.
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

      if (pago.status === ESTADOS_PAGO.AUTORIZADO) {
        return this.construirResultadoYaProcesado(pago);
      }

      if (pago.status === ESTADOS_PAGO.RECHAZADO) {
        await this.ordenesModel.liberarStockDeOrden(pago.orden_id, 'RECHAZADO');
        return this.construirResultadoYaProcesado(pago);
      }

      return await this.procesarCommit(tokenWs, pago);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Error al confirmar transacción con Transbank.', HTTP_STATUS.BAD_GATEWAY);
    }
  }

  /**
   * Consulta el estado real de una transacción en Transbank.
   * Se usa para reconciliar retornos ambiguos o reintentos de `commit`.
   *
   * @param {string} tokenWs Token de la transacción.
   * @returns {Promise<object>} Respuesta de `transaction.status`.
   * @throws {AppError} Si falta el token o Transbank falla.
   */
  async consultarEstadoTransaccion(tokenWs) {
    if (!tokenWs) {
      throw new AppError('Token de transacción requerido.', HTTP_STATUS.BAD_REQUEST);
    }
    try {
      return await this.transaction.status(tokenWs);
    } catch (error) {
      throw new AppError(
        'No se pudo consultar el estado de la transacción con Transbank.',
        HTTP_STATUS.BAD_GATEWAY,
        undefined,
        { cause: error },
      );
    }
  }

  /**
   * Consulta el estado tolerando fallos. Devuelve `null` si Transbank no
   * responde, para que el llamador pueda continuar con el estado persistido.
   *
   * @param {string} tokenWs Token de la transacción.
   * @returns {Promise<object|null>} Respuesta de `status` o `null`.
   */
  async consultarEstadoSeguro(tokenWs) {
    try {
      return await this.consultarEstadoTransaccion(tokenWs);
    } catch (error) {
      logger.warn({ err: error }, 'No fue posible consultar el estado en Transbank.');
      return null;
    }
  }

  /**
   * Marca una transacción como cancelada por el usuario (retorno con
   * `TBK_TOKEN` y sin `token_ws`). Antes de cancelar consulta el estado real:
   * si Transbank ya la autorizó, se persiste como pagada.
   *
   * @param {string} tokenWs Token de la transacción cancelada.
   * @param {string} [buyOrder] Buy order del intento, útil si el token no coincide.
   * @returns {Promise<object>} Resultado de la cancelación o del pago autorizado.
   * @throws {AppError} Si falta el token.
   */
  async cancelarTransaccion(tokenWs, buyOrder) {
    if (!tokenWs) {
      throw new AppError('Token de transacción requerido.', HTTP_STATUS.BAD_REQUEST);
    }

    const pago =
      (await this.pagosModel.obtenerPorToken(tokenWs)) ||
      (buyOrder ? await this.pagosModel.obtenerPorBuyOrder(buyOrder) : null);

    if (!pago) {
      return this.construirResultadoCancelacion(null, buyOrder);
    }

    if (pago.status === ESTADOS_PAGO.AUTORIZADO) {
      return this.construirResultadoYaProcesado(pago);
    }

    const estado = await this.consultarEstadoSeguro(tokenWs);
    if (esTransaccionAutorizada(estado)) {
      return this.persistirResultadoCommit(estado, pago);
    }

    await this.pagosModel.actualizarEstado(pago.orden_id, ESTADOS_PAGO.ERROR);
    await this.ordenesModel.liberarStockDeOrden(pago.orden_id, 'CANCELADO');
    return this.construirResultadoCancelacion(pago, buyOrder);
  }

  /**
   * Maneja el retorno de timeout de Webpay: llega `TBK_ORDEN_COMPRA` sin
   * `token_ws` ni `TBK_TOKEN`. Busca el pago por buy_order, consulta el estado
   * si hay token guardado y, si no fue autorizado, marca `TIMEOUT` y cancela la
   * orden.
   *
   * @param {object} datos Datos del retorno.
   * @param {string} datos.buyOrder Buy order reportado por Transbank.
   * @returns {Promise<object>} Resultado del timeout.
   * @throws {AppError} Si falta el buy order.
   */
  async manejarTimeout({ buyOrder } = {}) {
    if (!buyOrder) {
      throw new AppError('Buy order requerido para manejar el timeout.', HTTP_STATUS.BAD_REQUEST);
    }

    const pago = await this.pagosModel.obtenerPorBuyOrder(buyOrder);
    if (pago) {
      return this.resolverPagoEnTimeout(pago);
    }

    return this.cancelarOrdenPorTimeout(buyOrder);
  }

  /**
   * Resuelve un timeout cuando existe un pago registrado para el buy_order.
   * Consulta el estado real antes de descartar un pago autorizado.
   *
   * @param {object} pago Registro de pago encontrado.
   * @returns {Promise<object>} Resultado del timeout o del pago autorizado.
   */
  async resolverPagoEnTimeout(pago) {
    if (pago.status === ESTADOS_PAGO.AUTORIZADO) {
      return this.construirResultadoYaProcesado(pago);
    }

    const estado = pago.token_ws ? await this.consultarEstadoSeguro(pago.token_ws) : null;
    if (esTransaccionAutorizada(estado)) {
      return this.persistirResultadoCommit(estado, pago);
    }

    await this.pagosModel.actualizarEstado(pago.orden_id, ESTADOS_PAGO.TIMEOUT);
    await this.ordenesModel.liberarStockDeOrden(pago.orden_id, 'CANCELADO');
    return {
      autorizado: false,
      cancelado: false,
      timeout: true,
      yaProcesado: false,
      ordenId: pago.orden_id,
      buyOrder: pago.buy_order,
      monto: pago.amount,
    };
  }

  /**
   * Cancela la orden asociada a un timeout cuando no existe pago registrado.
   *
   * @param {string} buyOrder Buy order reportado por Transbank.
   * @returns {Promise<object>} Resultado del timeout.
   */
  async cancelarOrdenPorTimeout(buyOrder) {
    const orden = await this.ordenesModel.obtenerPorBuyOrder(buyOrder);
    if (orden) {
      await this.ordenesModel.liberarStockDeOrden(orden.id, 'CANCELADO');
      return {
        autorizado: false,
        cancelado: false,
        timeout: true,
        yaProcesado: false,
        ordenId: orden.id,
        buyOrder: orden.buy_order,
        monto: orden.monto_total,
      };
    }

    return {
      autorizado: false,
      cancelado: false,
      timeout: true,
      yaProcesado: false,
      ordenId: null,
      buyOrder,
      monto: null,
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
    } catch (commitError) {
      return this.reconciliarTrasFalloCommit(tokenWs, pago, commitError);
    }

    return this.persistirResultadoCommit(response, pago);
  }

  /**
   * Reconciliación tras un fallo de `commit` (p. ej. doble retorno).
   * Consulta el estado real: si está autorizado se marca `PAGADO`, si falló se
   * marca `RECHAZADO`; si no se puede determinar, se devuelve lo persistido.
   *
   * @param {string} tokenWs Token de la transacción.
   * @param {object} pago Registro de pago existente.
   * @param {Error} commitError Error original del commit.
   * @returns {Promise<object>} Resultado reconciliado.
   */
  async reconciliarTrasFalloCommit(tokenWs, pago, commitError) {
    logger.warn(
      { err: commitError, ordenId: pago.orden_id },
      'Commit de Webpay falló; consultando estado real.',
    );

    const estado = await this.consultarEstadoSeguro(tokenWs);
    if (esTransaccionAutorizada(estado) || estado?.status === 'FAILED') {
      return this.persistirResultadoCommit(estado, pago);
    }

    return this.construirResultadoYaProcesado(pago);
  }

  /**
   * Persiste una respuesta de Transbank (commit o status) y sincroniza la
   * orden según la regla centralizada de autorización.
   *
   * @param {object} response Respuesta de Transbank.
   * @param {object} pago Registro de pago existente.
   * @returns {Promise<object>} Resultado de la confirmación.
   */
  async persistirResultadoCommit(response, pago) {
    await this.pagosModel.actualizarConCommit(pago.orden_id, response);

    const autorizado = esTransaccionAutorizada(response);
    if (autorizado) {
      await this.ordenesModel.actualizarEstado(pago.orden_id, 'PAGADO');
    } else {
      await this.ordenesModel.liberarStockDeOrden(pago.orden_id, 'RECHAZADO');
    }

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
      cancelado: false,
      timeout: false,
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
   * Construye el resultado de una cancelación.
   *
   * @param {object|null} pago Registro de pago o `null` si no se encontró.
   * @param {string} [buyOrder] Buy order reportado por Transbank.
   * @returns {object} Resultado de la cancelación.
   */
  construirResultadoCancelacion(pago, buyOrder) {
    return {
      autorizado: false,
      cancelado: true,
      timeout: false,
      yaProcesado: Boolean(pago),
      ordenId: pago?.orden_id || null,
      buyOrder: pago?.buy_order || buyOrder || null,
      monto: pago?.amount || null,
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
      autorizado: pagoFinal.status === ESTADOS_PAGO.AUTORIZADO,
      cancelado: false,
      timeout: pagoFinal.status === ESTADOS_PAGO.TIMEOUT,
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
