'use strict';

const sendResponse = require('../utils/response');

/**
 * Controlador de login. Solo traduce HTTP ↔ servicio: extrae datos de la
 * petición, delega en el servicio y formatea la respuesta.
 */
class LoginController {
  /**
   * @param {import('../services/login.service')} loginService Servicio de autenticación.
   */
  constructor(loginService) {
    this.loginService = loginService;
  }

  /**
   * Autentica un usuario y devuelve el par de tokens.
   *
   * @param {import('express').Request} req Petición con `email` y `password` en el body.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con los tokens emitidos.
   * @throws {AppError} Propagado al `errorHandler` si las credenciales fallan.
   */
  async login(req, res) {
    const { email, password } = req.body;
    const data = await this.loginService.login(email, password);
    return sendResponse(res, { message: 'Inicio de sesión exitoso.', data });
  }

  /**
   * Cierra la sesión invalidando el refresh token.
   *
   * @param {import('express').Request} req Petición con `refreshToken` en el body.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con el mensaje de cierre.
   * @throws {AppError} Propagado al `errorHandler` si el token es inválido.
   */
  async logout(req, res) {
    const result = await this.loginService.logout(req.body.refreshToken);
    return sendResponse(res, { message: result });
  }

  /**
   * Renueva el par de tokens a partir del refresh token.
   *
   * @param {import('express').Request} req Petición con `refreshToken` en el body.
   * @param {import('express').Response} res Respuesta HTTP.
   * @returns {Promise<import('express').Response>} Respuesta con los tokens renovados.
   * @throws {AppError} Propagado al `errorHandler` si el token es inválido.
   */
  async refreshToken(req, res) {
    const data = await this.loginService.refreshToken(req.body.refreshToken);
    return sendResponse(res, { message: 'Token renovado.', data });
  }
}

module.exports = LoginController;
