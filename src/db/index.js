'use strict';

const { createPool } = require('./connection');

/**
 * Adaptador sobre `mysql2` que expone una interfaz estable para la capa de
 * modelos. Aplica el patrón **Adapter**: permite sustituir el driver o
 * inyectar un doble de prueba sin que los modelos conozcan `mysql2`.
 */
class Database {
  /**
   * @param {import('mysql2').Pool} pool Pool de conexiones de `mysql2`.
   */
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Ejecuta una consulta SQL preparada.
   *
   * @param {string} sql Sentencia SQL con marcadores `?`.
   * @param {Array<*>} [params=[]] Parámetros de la sentencia.
   * @returns {Promise<[*, import('mysql2').FieldPacket[]]>} Resultado crudo de `mysql2`.
   * @throws {Error} Si la ejecución de la consulta falla.
   */
  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  /**
   * Ejecuta una sentencia preparada (mayor rendimiento en ejecuciones repetidas).
   *
   * @param {string} sql Sentencia SQL con marcadores `?`.
   * @param {Array<*>} [params=[]] Parámetros de la sentencia.
   * @returns {Promise<[*, import('mysql2').FieldPacket[]]>} Resultado crudo de `mysql2`.
   * @throws {Error} Si la ejecución de la sentencia falla.
   */
  async execute(sql, params = []) {
    return this.pool.execute(sql, params);
  }

  /**
   * Comprueba que la base de datos responde (usado por el health check).
   *
   * @returns {Promise<boolean>} `true` si la conexión es válida.
   */
  async ping() {
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
      return true;
    } finally {
      connection.release();
    }
  }

  /**
   * Cierra el pool de conexiones.
   *
   * @returns {Promise<void>} Resolución cuando el pool termina de cerrarse.
   */
  async close() {
    await this.pool.end();
  }
}

/**
 * Crea la base de datos MySQL real a partir de las variables de entorno.
 *
 * @returns {Database} Adaptador de base de datos listo para inyectar.
 */
function createMySqlDatabase() {
  return new Database(createPool());
}

module.exports = { Database, createMySqlDatabase };
