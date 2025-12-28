function errorHandler(err, req, res, next) {
    console.error(err);

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Ocurrió un error inesperado en el servidor.';

    if (err.name === 'ValidationError') {
        statusCode = 400; // Bad Request
        message = 'Error de validación: ' + err.message;
    } else if (err.name === 'ReferenceError') {
        message = 'Error de referencia en el servidor. Contacte al administrador.';
    }

    res.status(statusCode).json({
        status: 'error',
        statusCode: statusCode,
        message: message
    });
}

module.exports = errorHandler;
