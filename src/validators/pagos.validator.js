'use strict';

const { z } = require('zod');

/**
 * Esquemas de validación para pagos con Transbank.
 *
 * @module validators/pagos.validator
 */

const itemCarritoSchema = z
  .object({
    asin: z.string().min(1).optional(),
    productoId: z.string().min(1).optional(),
    cantidad: z.coerce.number().int().positive({ message: 'La cantidad debe ser mayor a 0' }),
  })
  .refine((data) => data.asin || data.productoId, {
    message: 'Se requiere asin o productoId',
  });

const crearOrdenSchema = z.object({
  items: z.array(itemCarritoSchema).min(1, { message: 'Debe incluir al menos un producto' }),
  direccionEnvio: z.string().max(500).optional().nullable(),
});

const iniciarPagoSchema = z.object({
  ordenId: z.coerce.number().int().positive({ message: 'ordenId debe ser un número positivo' }),
});

module.exports = {
  crearOrdenSchema,
  iniciarPagoSchema,
};
