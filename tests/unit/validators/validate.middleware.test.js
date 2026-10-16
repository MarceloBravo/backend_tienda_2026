'use strict';

const validate = require('../../../src/validators/validate.middleware');
const { loginSchema, paginationSchema } = require('../../../src/validators/schemas');

/**
 * Crea un objeto de respuesta de Express simulado.
 *
 * @returns {object} Respuesta simulada.
 */
function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('validate middleware (Factory + Strategy)', () => {
  it('deja pasar datos válidos y sanea la fuente', () => {
    const middleware = validate(loginSchema);
    const req = { body: { email: 'A@B.com', password: 'x', extra: 'ignorado' } };
    const next = jest.fn();

    middleware(req, createRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.email).toBe('a@b.com');
    expect(req.body.extra).toBeUndefined();
  });

  it('delega un error 400 cuando los datos son inválidos', () => {
    const middleware = validate(loginSchema);
    const req = { body: { email: 'no-es-email' } };
    const next = jest.fn();

    middleware(req, createRes(), next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });

  it('valida la fuente indicada (query) y aplica valores por defecto', () => {
    const middleware = validate(paginationSchema, 'query');
    const req = { query: {} };
    const next = jest.fn();

    middleware(req, createRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 1, limit: 10 });
  });
});
