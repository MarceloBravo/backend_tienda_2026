'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Construye la configuración del pool de conexiones a partir de las variables
 * de entorno.
 *
 * @returns {import('mysql2').PoolOptions} Configuración del pool.
 */
function buildPoolConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 5,
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 60000,
  };
}

/**
 * Crea un pool de conexiones de MySQL sin establecer conexión todavía.
 * La creación se aísla aquí para poder inyectar un pool simulado en pruebas.
 *
 * @param {import('mysql2').PoolOptions} [config] Configuración opcional del pool.
 * @returns {import('mysql2').Pool} Pool de conexiones.
 */
function createPool(config = buildPoolConfig()) {
  return mysql.createPool(config);
}

module.exports = { createPool, buildPoolConfig };
