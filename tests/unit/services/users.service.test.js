'use strict';

const UsersService = require('../../../src/services/users.service');

/**
 * Crea un modelo de usuarios simulado.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createUsersModelMock() {
  return {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePassword: jest.fn(),
    remove: jest.fn(),
  };
}

describe('UsersService', () => {
  let usersModel;
  let service;

  beforeEach(() => {
    usersModel = createUsersModelMock();
    service = new UsersService(usersModel);
  });

  it('lista usuarios delegando en el modelo', async () => {
    usersModel.getAll.mockResolvedValue([{ id: 1 }]);

    const users = await service.list({ search: 'a', page: 1, limit: 10 });

    expect(users).toEqual([{ id: 1 }]);
    expect(usersModel.getAll).toHaveBeenCalledWith('a', 1, 10);
  });

  it('lanza 404 cuando el usuario no existe', async () => {
    usersModel.getById.mockResolvedValue(undefined);

    await expect(service.getById(1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('crea un usuario hasheando la contraseña', async () => {
    usersModel.create.mockResolvedValue({ insertId: 5 });
    usersModel.getById.mockResolvedValue({ id: 5, username: 'nuevo' });

    const user = await service.create({
      username: 'nuevo',
      nombre: 'N',
      apellido: 'A',
      rol: 'invitado',
      email: 'n@a.com',
      password: 'secret123',
      extra: 'ignorado',
    });

    expect(user).toEqual({ id: 5, username: 'nuevo' });
    const payload = usersModel.create.mock.calls[0][0];
    expect(payload.password).not.toBe('secret123');
    expect(payload.extra).toBeUndefined();
  });

  it('traduce el duplicado de username a un error 409', async () => {
    usersModel.create.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

    await expect(
      service.create({
        username: 'dup',
        nombre: 'N',
        apellido: 'A',
        rol: 'invitado',
        email: 'd@a.com',
        password: 'secret123',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('actualiza el usuario y, si hay password, lo re-hashea', async () => {
    usersModel.getById.mockResolvedValue({ id: 1, username: 'u' });
    usersModel.update.mockResolvedValue({ affectedRows: 1 });
    usersModel.updatePassword.mockResolvedValue({ affectedRows: 1 });

    await service.update(1, {
      username: 'u',
      nombre: 'N',
      apellido: 'A',
      rol: 'admin',
      email: 'u@a.com',
      password: 'nuevaclave',
    });

    expect(usersModel.updatePassword).toHaveBeenCalled();
    const [, hashed] = usersModel.updatePassword.mock.calls[0];
    expect(hashed).not.toBe('nuevaclave');
  });

  it('no actualiza el password cuando viene vacío', async () => {
    usersModel.getById.mockResolvedValue({ id: 1 });
    usersModel.update.mockResolvedValue({ affectedRows: 1 });

    await service.update(1, {
      username: 'u',
      nombre: 'N',
      apellido: 'A',
      rol: 'admin',
      email: 'u@a.com',
      password: '',
    });

    expect(usersModel.updatePassword).not.toHaveBeenCalled();
  });

  it('elimina un usuario existente', async () => {
    usersModel.getById.mockResolvedValue({ id: 1 });
    usersModel.remove.mockResolvedValue({ affectedRows: 1 });

    await expect(service.remove(1)).resolves.toBeUndefined();
  });

  it('lanza 404 si la eliminación no afecta filas', async () => {
    usersModel.getById.mockResolvedValue({ id: 1 });
    usersModel.remove.mockResolvedValue({ affectedRows: 0 });

    await expect(service.remove(1)).rejects.toMatchObject({ statusCode: 404 });
  });
});
