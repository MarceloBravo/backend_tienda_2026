'use strict';

const multer = require('multer');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

/**
 * Middleware de subida de archivos (Multer) para imágenes de producto.
 * Limita el tamaño a 5 MB por archivo.
 *
 * @type {import('multer').Multer}
 */
const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

module.exports = upload;
