'use strict';

const {
  WebpayPlus,
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
 * Alias aceptados para el entorno de Transbank.
 * Cualquier valor desconocido cae en integración para evitar llamadas
 * accidentales a producción.
 *
 * @readonly
 * @type {Readonly<Record<string, 'integration'|'production'>>}
 */
const ENVIRONMENT_ALIASES = Object.freeze({
  integration: 'integration',
  integracion: 'integration',
  production: 'production',
  produccion: 'production',
});

/**
 * Normaliza el nombre del entorno configurado.
 *
 * @param {string|undefined} valor Valor de `TRANSBANK_ENVIRONMENT`.
 * @returns {'integration'|'production'} Entorno normalizado.
 */
function normalizarEntorno(valor) {
  const normalizado = String(valor || 'integration')
    .trim()
    .toLowerCase();
  return ENVIRONMENT_ALIASES[normalizado] || 'integration';
}

/**
 * Obtiene la instancia de WebpayPlus.Transaction configurada.
 * Por defecto usa el entorno de integración con las credenciales públicas de
 * Transbank.
 *
 * @returns {WebpayPlus.Transaction} Instancia de Transacción de Webpay Plus.
 * @throws {Error} Si se configura producción sin credenciales.
 */
function getWebpayTransaction() {
  const environment = normalizarEntorno(process.env.TRANSBANK_ENVIRONMENT);

  if (environment === 'production') {
    const commerceCode = process.env.TRANSBANK_COMMERCE_CODE;
    const apiKey = process.env.TRANSBANK_API_KEY;
    if (!commerceCode || !apiKey) {
      throw new Error(
        'TRANSBANK_COMMERCE_CODE y TRANSBANK_API_KEY son obligatorios en producción.',
      );
    }
    return new WebpayPlus.Transaction(new Options(commerceCode, apiKey, Environment.Production));
  }

  const commerceCode = process.env.TRANSBANK_COMMERCE_CODE || IntegrationCommerceCodes.WEBPAY_PLUS;
  const apiKey = process.env.TRANSBANK_API_KEY || IntegrationApiKeys.WEBPAY;
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
  normalizarEntorno,
};
