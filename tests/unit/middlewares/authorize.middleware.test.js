'use strict';

const {
  authorize,
  ADMIN_ROLES,
  MANAGER_ROLES,
} = require('../../../src/middlewares/authorize.middleware');

/**
 * Crea un objeto de respuesta de Express simulado.
 *
 * @returns {object} Respuesta simulada.
 */
function createRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('authorize middleware', () => {
  it('permite el acceso cuando el rol está autorizado', () => {
    const middleware = authorize(...ADMIN_ROLES);
    const req = { user: { rol: 'admin' } };
    const next = jest.fn();

    middleware(req, createRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('deniega con 403 cuando el rol no está autorizado', () => {
    const middleware = authorize(...ADMIN_ROLES);
    const req = { user: { rol: 'invitado' } };
    const next = jest.fn();

    middleware(req, createRes(), next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('deniega cuando no hay usuario autenticado', () => {
    const middleware = authorize(...MANAGER_ROLES);
    const next = jest.fn();

    middleware({}, createRes(), next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });

  it('permite a supervisor en roles de gestión', () => {
    const middleware = authorize(...MANAGER_ROLES);
    const next = jest.fn();

    middleware({ user: { rol: 'supervisor' } }, createRes(), next);

    expect(next).toHaveBeenCalledWith();
  });
});
