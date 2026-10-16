const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  let cnn;
  try {
    cnn = await coneccion();
    const dbName = process.env.DB_NAME || 'tienda2';
    await cnn.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
    await cnn.end();

    cnn = await coneccion(dbName, true);

    const schemaPath = path.join(__dirname, '..', 'src', 'db', 'database.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    console.log('Ejecutando script para crear tablas e insertar datos...');

    await cnn.query(schemaSQL);

    console.log('¡Tablas e inserciones creadas correctamente!');
  } catch (error) {
    console.error('Error al crear la base de datos:', error);
  } finally {
    if (cnn) {
      await cnn.end();
    }
  }
}

async function coneccion(database, multipleStatements = false) {
  const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: multipleStatements,
  };
  if (database) {
    dbConfig.database = database;
  }

  return await mysql.createConnection(dbConfig);
}

initDatabase();
