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
    const resultado = this.esCancelacion(req)
      ? await this.transbankService.cancelarTransaccion(tokenWs)
      : await this.transbankService.confirmarTransaccion(tokenWs);

    if (this.debeRedirigirAlFrontend(req)) {
      return res.redirect(this.construirUrlFrontend(resultado));
    }

    return sendResponse(res, {
      statusCode: HTTP_STATUS.OK,
      message: resultado.autorizado
        ? 'Pago autorizado exitosamente.'
        : 'Pago rechazado o no autorizado.',
      data: resultado,
    });
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
    return req.body?.token_ws || req.query?.token_ws || req.body?.TBK_TOKEN;
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
    const estado = resultado.autorizado ? 'success' : 'fail';
    const buyOrder = resultado.buyOrder || '';
    const ordenId = resultado.ordenId || '';
    return `${base}/pago/resultado?estado=${estado}&buyOrder=${buyOrder}&ordenId=${ordenId}`;
  }
}

module.exports = TransbankController;
