'use strict';

const sendResponse = require('../utils/response');
const { HTTP_STATUS } = require('../config/constants');
const { crearOrdenPayload, iniciarPagoPayload } = require('../dto/pagos.dto');

/**
 * Controlador de pagos con Transbank (Webpay Plus / Redcompra).
 * Traduce HTTP ↔ servicios y delega toda la lógica de negocio.
 *
 * @class TransbankController
 */
class TransbankController {
  /**
   * @param {import('../services/ordenes.service')} ordenesService Servicio de órdenes.
   * @param {import('../services/transbank.service')} transbankService Servicio de Transbank.
   * @param {import('../models/pagos.model')} pagosModel Modelo de pagos.
   */
  constructor(ordenesService, transbankService, pagosModel) {
    this.ordenesService = ordenesService;
    this.transbankService = transbankService;
    this.pagosModel = pagosModel;
  }

  /**
   * Crea una orden desde el carrito calculando montos en el servidor.
   * `POST /api/pagos/crear-orden`.
   *
   * @param {import('express').Request} req Petición con `items` y `direccionEnvio`.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta 201 con la orden creada.
   * @throws {AppError} Propagado al `errorHandler`.
   */
  async crearOrden(req, res) {
    const payload = crearOrdenPayload(req.body || {});
    const usuarioId = req.user?.id || null;
    const orden = await this.ordenesService.crearOrden({
      usuarioId,
      items: payload.items,
      direccionEnvio: payload.direccionEnvio || null,
    });

    return sendResponse(res, {
      statusCode: HTTP_STATUS.CREATED,
      message: 'Orden creada exitosamente.',
      data: orden,
    });
  }

  /**
   * Inicia una transacción de Webpay Plus para una orden existente.
   * `POST /api/pagos/iniciar`.
   *
   * @param {import('express').Request} req Petición con `ordenId`.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con `{ url, token, buyOrder, amount }`.
   * @throws {AppError} Propagado al `errorHandler`.
   */
  async iniciarPago(req, res) {
    const payload = iniciarPagoPayload(req.body || {});
    const usuarioId = req.user?.id || null;
    const orden = await this.ordenesService.validarPertenencia(payload.ordenId, usuarioId);
    const resultado = await this.transbankService.iniciarTransaccion(orden);

    return sendResponse(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Transacción iniciada exitosamente.',
      data: resultado,
    });
  }

  /**
   * Procesa el retorno de Transbank tras el pago del cliente.
   * `POST|GET /api/pagos/retorno`.
   *
   * @param {import('express').Request} req Petición con `token_ws` en body o query.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response|void>} JSON con el resultado o redirección al frontend.
   * @throws {AppError} Propagado al `errorHandler`.
   */
  async retorno(req, res) {
    const tokenWs = this.extraerToken(req);
    let resultado;

    if (this.esTimeout(req)) {
      resultado = await this.transbankService.manejarTimeout({
        buyOrder: this.extraerOrdenCompra(req),
      });
    } else if (this.esCancelacion(req)) {
      resultado = await this.transbankService.cancelarTransaccion(
        tokenWs,
        this.extraerOrdenCompra(req),
      );
    } else {
      resultado = await this.transbankService.confirmarTransaccion(tokenWs);
    }

    if (this.debeRedirigirAlFrontend(req)) {
      return res.redirect(this.construirUrlFrontend(resultado));
    }

    return sendResponse(res, {
      statusCode: HTTP_STATUS.OK,
      message: this.construirMensaje(resultado),
      data: resultado,
    });
  }

  /**
   * Determina si el retorno corresponde a un timeout de Webpay.
   * Transbank envía `TBK_ID_SESION` y `TBK_ORDEN_COMPRA`, sin `token_ws` ni
   * `TBK_TOKEN`, cuando el usuario no completa el pago a tiempo.
   *
   * @param {import('express').Request} req Petición HTTP.
   * @returns {boolean} `true` si el retorno representa un timeout.
   */
  esTimeout(req) {
    const body = req.body || {};
    const query = req.query || {};
    const tieneTokenWs = Boolean(body.token_ws || query.token_ws);
    const tieneTbkToken = Boolean(body.TBK_TOKEN || query.TBK_TOKEN);
    const tieneOrdenCompra = Boolean(body.TBK_ORDEN_COMPRA || query.TBK_ORDEN_COMPRA);
    return !tieneTokenWs && !tieneTbkToken && tieneOrdenCompra;
  }

  /**
   * Construye el mensaje de respuesta según el resultado del pago.
   *
   * @param {object} resultado Resultado de la operación.
   * @returns {string} Mensaje legible.
   */
  construirMensaje(resultado) {
    if (resultado.timeout) {
      return 'Tiempo de pago agotado.';
    }
    if (resultado.cancelado) {
      return 'Pago cancelado por el usuario.';
    }
    return resultado.autorizado
      ? 'Pago autorizado exitosamente.'
      : 'Pago rechazado o no autorizado.';
  }

  /**
   * Determina si el retorno corresponde a una cancelación del usuario.
   * Transbank envía `TBK_TOKEN` (sin `token_ws`) cuando se cancela el pago.
   *
   * @param {import('express').Request} req Petición HTTP.
   * @returns {boolean} `true` si la transacción fue cancelada.
   */
  esCancelacion(req) {
    const body = req.body || {};
    const query = req.query || {};
    const tieneTokenWs = Boolean(body.token_ws || query.token_ws);
    const tieneTbkToken = Boolean(body.TBK_TOKEN || query.TBK_TOKEN);
    return tieneTbkToken && !tieneTokenWs;
  }

  /**
   * Consulta el estado de una orden y su pago asociado.
   * `GET /api/pagos/estado/:ordenId`.
   *
   * @param {import('express').Request} req Petición con `ordenId` en params.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con orden y pago.
   * @throws {AppError} Propagado al `errorHandler`.
   */
  async estado(req, res) {
    const ordenId = Number(req.params.ordenId);
    const usuarioId = req.user?.id || null;
    const orden = await this.ordenesService.validarPertenencia(ordenId, usuarioId);
    const pago = await this.pagosModel.obtenerPorOrdenId(ordenId);

    return sendResponse(res, {
      statusCode: HTTP_STATUS.OK,
      message: 'Estado de la orden obtenido.',
      data: { orden, pago },
    });
  }

  /**
   * Extrae el token de la petición de retorno de Transbank.
   *
   * @param {import('express').Request} req Petición HTTP.
   * @returns {string|undefined} Token Webpay si está presente.
   */
  extraerToken(req) {
    return req.body?.token_ws || req.query?.token_ws || req.body?.TBK_TOKEN || req.query?.TBK_TOKEN;
  }

  /**
   * Extrae el buy order reportado por Transbank en el retorno.
   *
   * @param {import('express').Request} req Petición HTTP.
   * @returns {string|undefined} Buy order si está presente.
   */
  extraerOrdenCompra(req) {
    return req.body?.TBK_ORDEN_COMPRA || req.query?.TBK_ORDEN_COMPRA;
  }

  /**
   * Determina si la respuesta debe redirigir al frontend.
   *
   * @param {import('express').Request} req Petición HTTP.
   * @returns {boolean} `true` si hay URL de frontend y el cliente acepta HTML.
   */
  debeRedirigirAlFrontend(req) {
    const frontendUrl = this.obtenerFrontendUrl();
    const aceptaHtml = typeof req.accepts === 'function' ? req.accepts(['html', 'json']) : 'json';
    return Boolean(frontendUrl) && aceptaHtml !== 'json';
  }

  /**
   * Obtiene la URL base del frontend configurada.
   *
   * @returns {string|undefined} URL del frontend o `undefined`.
   */
  obtenerFrontendUrl() {
    return process.env.FRONTEND_URL || process.env.FRONTEND_URL2;
  }

  /**
   * Construye la URL de resultado en el frontend.
   *
   * @param {object} resultado Resultado de la confirmación.
   * @returns {string} URL de redirección.
   */
  construirUrlFrontend(resultado) {
    const base = this.obtenerFrontendUrl().replace(/\/$/, '');
    const estado = this.obtenerEstadoResultado(resultado);
    const buyOrder = resultado.buyOrder || '';
    const ordenId = resultado.ordenId || '';
    return `${base}/pago/resultado?estado=${estado}&buyOrder=${buyOrder}&ordenId=${ordenId}`;
  }

  /**
   * Traduce el resultado a un estado apto para la URL del frontend.
   *
   * @param {object} resultado Resultado de la operación.
   * @returns {'success'|'fail'|'timeout'} Estado del resultado.
   */
  obtenerEstadoResultado(resultado) {
    if (resultado.timeout) return 'timeout';
    return resultado.autorizado ? 'success' : 'fail';
  }
}

module.exports = TransbankController;
