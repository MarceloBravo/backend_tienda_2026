'use strict';

const { createProductSchema, updateProductSchema } = require('../../../src/validators/schemas');

/**
 * Datos mínimos válidos para crear un producto.
 *
 * @returns {object} Body válido de creación.
 */
function buildCreatePayload() {
  return {
    asin: 'A1',
    currency: 'CLP',
    product_price: 10,
    product_title: 'Producto',
  };
}

describe('esquemas de producto', () => {
  it('acepta stock numérico al crear', () => {
    const result = createProductSchema.safeParse({ ...buildCreatePayload(), stock: 25 });

    expect(result.success).toBe(true);
    expect(result.data.stock).toBe(25);
  });

  it('convierte stock recibido como texto desde multipart/form-data', () => {
    const result = createProductSchema.safeParse({ ...buildCreatePayload(), stock: '12' });

    expect(result.success).toBe(true);
    expect(result.data.stock).toBe(12);
  });

  it('rechaza stock negativo o decimal al crear', () => {
    expect(createProductSchema.safeParse({ ...buildCreatePayload(), stock: -1 }).success).toBe(
      false,
    );
    expect(createProductSchema.safeParse({ ...buildCreatePayload(), stock: 1.5 }).success).toBe(
      false,
    );
  });

  it('acepta stock al actualizar', () => {
    const result = updateProductSchema.safeParse({
      currency: 'CLP',
      product_price: 10,
      product_title: 'Producto',
      stock: 7,
    });

    expect(result.success).toBe(true);
    expect(result.data.stock).toBe(7);
  });

  it('permite omitir stock al actualizar', () => {
    const result = updateProductSchema.safeParse({
      currency: 'CLP',
      product_price: 10,
      product_title: 'Producto',
    });

    expect(result.success).toBe(true);
    expect(result.data.stock).toBeUndefined();
  });
});
