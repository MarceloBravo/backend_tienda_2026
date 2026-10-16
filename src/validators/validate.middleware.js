'use strict';

const AppError = require('../errors/AppError');

/**
 * Construye el mensaje legible a partir de los issues de validación de Zod.
 *
 * @param {import('zod').ZodError} error Error de validación.
 * @returns {string} Mensaje concatenado de los campos inválidos.
 */
function formatIssues(error) {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join(' | ');
}

/**
 * Fábrica de middlewares de validación (patrón **Factory**). Recibe un esquema
 * de Zod (la **Strategy** de validación) y devuelve un middleware que valida y
 * sanea la fuente indicada, descartando campos desconocidos.
 *
 * @param {import('zod').ZodTypeAny} schema Esquema de validación de Zod.
 * @param {'body'|'query'|'params'} [source='body'] Parte de la petición a validar.
 * @returns {import('express').RequestHandler} Middleware de validación.
 */
function validate(schema, source = 'body') {
  return function validationMiddleware(req, res, next) {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      next(AppError.badRequest(formatIssues(result.error)));
      return;
    }
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}

module.exports = validate;
