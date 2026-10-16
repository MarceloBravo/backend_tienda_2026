'use strict';

const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';

/**
 * Logger centralizado de la aplicación (reemplaza a `console.log`).
 * Emite líneas JSON a la salida estándar para integrarse con Docker/monitoreo.
 *
 * @type {import('pino').Logger}
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
