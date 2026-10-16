'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const AppError = require('../errors/AppError');
const { HTTP_STATUS, ERROR_CODES } = require('../config/constants');

/**
 * Servicio de autenticación: valida credenciales, emite y renueva tokens JWT y
 * gestiona el ciclo de vida del refresh token.
 */
class LoginService {
  /**
   * @param {import('../models/users.model')} usersModel Repositorio de usuarios.
   */
  constructor(usersModel) {
    this.usersModel = usersModel;
  }

  /**
   * Autentica a un usuario mediante email y contraseña.
   *
   * @param {string} email Email del usuario.
   * @param {string} password Contraseña en texto plano.
   * @returns {Promise<{access_token: string, refresh_token: string}>} Par de tokens emitidos.
   * @throws {AppError} 401 si las credenciales son inválidas.
   */
  async login(email, password) {
    const user = await this.usersModel.findByEmail(email);
    if (!user) {
      throw AppError.unauthorized('Usuario o contraseña incorrectos. Inténtalo nuevamente.');
    }

    const isPasswordValid = await bcrypt.compare(String(password), String(user.password));
    if (!isPasswordValid) {
      throw AppError.unauthorized('Usuario o contraseña incorrectos. Inténtalo nuevamente.');
    }

    const tokens = this.generateTokens(user);
    await this.usersModel.updateRefreshToken(user.id, tokens.refresh_token);
    return tokens;
  }

  /**
   * Cierra la sesión invalidando el refresh token.
   *
   * @param {string} refreshToken Refresh token de la sesión.
   * @returns {Promise<string>} Mensaje resultante de la operación.
   * @throws {AppError} 401 si el token es inválido o está expirado.
   */
  async logout(refreshToken) {
    const payload = this.verifyRefreshToken(refreshToken);
    const result = await this.usersModel.clearRefreshToken(payload.user.id);
    return result.affectedRows === 0
      ? 'No se pudo cerrar la sesión.'
      : 'Sesión cerrada exitosamente.';
  }

  /**
   * Renueva el par de tokens a partir de un refresh token válido.
   *
   * @param {string} refreshToken Refresh token de la sesión.
   * @returns {Promise<{access_token: string, refresh_token: string}>} Par de tokens renovados.
   * @throws {AppError} 401 si el token es inválido, expirado o no coincide con la sesión.
   */
  async refreshToken(refreshToken) {
    const payload = this.verifyRefreshToken(refreshToken);
    const user = await this.usersModel.findByRefreshToken(payload.user.id, refreshToken);
    if (!user) {
      throw AppError.unauthorized('Usuario no encontrado o inexistente. Logueate nuevamente...');
    }

    const tokens = this.generateTokens(user);
    await this.usersModel.updateRefreshToken(payload.user.id, tokens.refresh_token);
    return tokens;
  }

  /**
   * Verifica y decodifica un refresh token.
   *
   * @param {string} refreshToken Refresh token a verificar.
   * @returns {object} Payload decodificado del token.
   * @throws {AppError} 401 si el token es inválido o está expirado.
   */
  verifyRefreshToken(refreshToken) {
    try {
      return jwt.verify(refreshToken, process.env.REFRESHTOKEN_SECRETS);
    } catch (error) {
      throw new AppError(
        'Sesión inválida o expirada. Inicie sesión nuevamente.',
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED,
        { cause: error },
      );
    }
  }

  /**
   * Genera los tokens de acceso y refresco para un usuario.
   *
   * @param {object} user Usuario autenticado (no debe exponer campos sensibles).
   * @returns {{access_token: string, refresh_token: string}} Par de tokens firmados.
   * @throws {Error} Si la firma de los tokens falla.
   */
  generateTokens(user) {
    const sanitizedUser = { ...user };
    delete sanitizedUser.password;
    delete sanitizedUser.refresh_token;

    const accessToken = jwt.sign({ user: sanitizedUser }, process.env.TOKEN_SECRETS, {
      expiresIn: process.env.EXPIRES_TIME_TOKEN,
    });
    const refreshToken = jwt.sign({ user: sanitizedUser }, process.env.REFRESHTOKEN_SECRETS, {
      expiresIn: process.env.EXPIRES_TIME_REFRESHTOKEN,
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }
}

module.exports = LoginService;
