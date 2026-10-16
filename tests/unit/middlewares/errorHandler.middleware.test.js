'use strict';

const errorHandler = require('../../../src/middlewares/errorHandler.middleware');
const AppError = require('../../../src/errors/AppError');

/**
 * Crea un objeto de respuesta de Express simulado.
 *
 * @returns {object} Respuesta simulada.
 */
function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('errorHandler middleware', () => {
  it('responde con el statusCode de un AppError operacional', () => {
    const res = createRes();

    errorHandler(AppError.notFound('Usuario no encontrado.'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      statusCode: 404,
      message: 'Usuario no encontrado.',
      code: 'NOT_FOUND',
    });
  });

  it('convierte errores no operacionales en 500 sin filtrar detalles', () => {
    const res = createRes();

    errorHandler(new Error('detalle interno'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      statusCode: 500,
      message: 'Ocurrió un error inesperado en el servidor.',
    });
  });

  it('respeta err.status cuando no hay statusCode', () => {
    const res = createRes();
    const err = new Error('teapot');
    err.status = 418;

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(418);
  });
});
