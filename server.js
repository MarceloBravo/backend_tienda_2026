'use strict';

require('dotenv').config();
const { createMySqlDatabase } = require('./src/db');
const { createContainer } = require('./src/container');
const { createApp } = require('./src/app');
const logger = require('./src/utils/logger');

/**
 * Arranca el servidor HTTP: crea la base de datos, el contenedor de
 * dependencias, la aplicación Express y comienza a escuchar peticiones.
 * Registra un cierre ordenado ante `SIGTERM`/`SIGINT`.
 *
 * @returns {import('http').Server} Instancia del servidor HTTP.
 */
function start() {
  const database = createMySqlDatabase();
  const controllers = createContainer(database);
  const app = createApp({ controllers, database });

  const port = process.env.PORT || 3000;
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`Servidor activo en el puerto ${port}`);
  });

  const shutdown = () => {
    logger.info('Cerrando servidor...');
    server.close(() => {
      database.close().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start };
