'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const LoginService = require('../../../src/services/login.service');

/**
 * Crea un modelo de usuarios simulado para las pruebas.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createUsersModelMock() {
  return {
    findByEmail: jest.fn(),
    updateRefreshToken: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    clearRefreshToken: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    findByRefreshToken: jest.fn(),
  };
}

describe('LoginService', () => {
  let usersModel;
  let service;
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('secret123', 4);
  });

  beforeEach(() => {
    usersModel = createUsersModelMock();
    service = new LoginService(usersModel);
  });

  describe('login', () => {
    it('devuelve un par de tokens cuando las credenciales son válidas', async () => {
      usersModel.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        rol: 'admin',
        password: passwordHash,
      });

      const tokens = await service.login('a@b.com', 'secret123');

      expect(tokens.access_token).toBeDefined();
      expect(tokens.refresh_token).toBeDefined();
      expect(usersModel.updateRefreshToken).toHaveBeenCalledWith(1, tokens.refresh_token);
    });

    it('lanza 401 cuando el password es inválido', async () => {
      usersModel.findByEmail.mockResolvedValue({ id: 1, password: passwordHash });

      await expect(service.login('a@b.com', 'incorrecto')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('lanza 401 cuando el usuario no existe', async () => {
      usersModel.findByEmail.mockResolvedValue(undefined);

      await expect(service.login('x@y.com', 'secret123')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('logout', () => {
    it('invalida el refresh token y confirma el cierre', async () => {
      const refreshToken = jwt.sign({ user: { id: 1 } }, process.env.REFRESHTOKEN_SECRETS);

      const message = await service.logout(refreshToken);

      expect(message).toBe('Sesión cerrada exitosamente.');
      expect(usersModel.clearRefreshToken).toHaveBeenCalledWith(1);
    });

    it('lanza 401 cuando el refresh token es inválido', async () => {
      await expect(service.logout('token-invalido')).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('refreshToken', () => {
    it('renueva los tokens cuando la sesión existe', async () => {
      const refreshToken = jwt.sign({ user: { id: 1 } }, process.env.REFRESHTOKEN_SECRETS);
      usersModel.findByRefreshToken.mockResolvedValue({ id: 1, rol: 'admin', password: 'hash' });

      const tokens = await service.refreshToken(refreshToken);

      expect(tokens.access_token).toBeDefined();
      expect(usersModel.updateRefreshToken).toHaveBeenCalled();
    });

    it('lanza 401 cuando la sesión no coincide', async () => {
      const refreshToken = jwt.sign({ user: { id: 99 } }, process.env.REFRESHTOKEN_SECRETS);
      usersModel.findByRefreshToken.mockResolvedValue(undefined);

      await expect(service.refreshToken(refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('generateTokens', () => {
    it('no incluye campos sensibles en el payload firmado', () => {
      const tokens = service.generateTokens({
        id: 1,
        rol: 'admin',
        password: 'hash',
        refresh_token: 'rt',
      });
      const decoded = jwt.verify(tokens.access_token, process.env.TOKEN_SECRETS);

      expect(decoded.user.password).toBeUndefined();
      expect(decoded.user.refresh_token).toBeUndefined();
    });
  });
});
