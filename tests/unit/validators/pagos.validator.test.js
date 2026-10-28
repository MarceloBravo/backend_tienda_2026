'use strict';

const { crearOrdenSchema, iniciarPagoSchema } = require('../../../src/validators/pagos.validator');

describe('pagos.validator', () => {
  describe('crearOrdenSchema', () => {
    it('acepta items con asin y cantidad entera positiva', () => {
      const result = crearOrdenSchema.safeParse({ items: [{ asin: 'A1', cantidad: 2 }] });
      expect(result.success).toBe(true);
    });

    it('acepta productoId en lugar de asin', () => {
      const result = crearOrdenSchema.safeParse({ items: [{ productoId: 'A1', cantidad: '3' }] });
      expect(result.success).toBe(true);
      expect(result.data.items[0].cantidad).toBe(3);
    });

    it('rechaza un carrito vacío', () => {
      expect(crearOrdenSchema.safeParse({ items: [] }).success).toBe(false);
    });

    it('rechaza un item sin identificador de producto', () => {
      expect(crearOrdenSchema.safeParse({ items: [{ cantidad: 1 }] }).success).toBe(false);
    });

    it('rechaza cantidades no positivas', () => {
      expect(crearOrdenSchema.safeParse({ items: [{ asin: 'A1', cantidad: 0 }] }).success).toBe(
        false,
      );
    });
  });

  describe('iniciarPagoSchema', () => {
    it('acepta un ordenId válido', () => {
      const result = iniciarPagoSchema.safeParse({ ordenId: '5' });
      expect(result.success).toBe(true);
      expect(result.data.ordenId).toBe(5);
    });

    it('rechaza ordenId inválido', () => {
      expect(iniciarPagoSchema.safeParse({ ordenId: -1 }).success).toBe(false);
      expect(iniciarPagoSchema.safeParse({}).success).toBe(false);
    });
  });
});
