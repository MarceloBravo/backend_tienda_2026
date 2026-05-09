const mysql = require('mysql2/promise');
require('dotenv').config();


const dbConfig = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 5, // Número máximo de conexiones en el pool (1 GB de RAM)
        acquireTimeout: 60000, // Tiempo máximo para adquirir una conexión (en milisegundos)
        timeout: 60000, // Tiempo máximo para ejecutar una consulta (en milisegundos)
    };

const pool = mysql.createPool(dbConfig);


module.exports = pool;