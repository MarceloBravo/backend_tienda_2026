'use strict';

const { WebpayPlus } = require('transbank-sdk');
const {
  Options,
  IntegrationCommerceCodes,
  IntegrationApiKeys,
  Environment,
} = require('transbank-sdk');

/**
 * Configuración de Transbank Webpay Plus.
 * Inicializa el objeto Transaction según el entorno configurado.
 *
 * @module config/transbank
 */

/**
 * Obtiene la instancia de WebpayPlus.Transaction configurada.
 *
 * @returns {WebpayPlus.Transaction} Instancia de Transacción de Webpay Plus.
 * @throws {Error} Si faltan variables de entorno requeridas.
 */
function getWebpayTransaction() {
  const environment = process.env.TRANSBANK_ENVIRONMENT || 'integration';
  const commerceCode = process.env.TRANSBANK_COMMERCE_CODE || IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = process.env.TRANSBANK_API_KEY || IntegrationApiKeys.WEBPAY;

  if (environment === 'production') {
    return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, Environment.Production));
  }

  return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, Environment.Integration));
}

/**
 * Obtiene la URL de retorno configurada.
 *
 * @returns {string} URL de retorno para Webpay.
 */
function getReturnUrl() {
  if (process.env.TRANSBANK_RETURN_URL) {
    return process.env.TRANSBANK_RETURN_URL;
  }
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${backendUrl}/api/pagos/retorno`;
}

module.exports = {
  getWebpayTransaction,
  getReturnUrl,
};
