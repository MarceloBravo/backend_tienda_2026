'use strict';

const ProductosService = require('../../../src/services/productos.service');

/**
 * Crea un modelo de productos simulado.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createProductoModelMock() {
  return {
    getAll: jest.fn(),
    getByAsin: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}

describe('ProductosService', () => {
  let productoModel;
  let service;

  beforeEach(() => {
    productoModel = createProductoModelMock();
    service = new ProductosService(productoModel);
  });

  it('lista productos delegando en el modelo', async () => {
    productoModel.getAll.mockResolvedValue([{ asin: 'A1' }]);

    const products = await service.list({ search: null, page: 1, limit: 10 });

    expect(products).toEqual([{ asin: 'A1' }]);
    expect(productoModel.getAll).toHaveBeenCalledWith(null, 1, 10);
  });

  it('lanza 404 cuando el producto no existe', async () => {
    productoModel.getByAsin.mockResolvedValue(undefined);

    await expect(service.getByAsin('NOPE')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('crea un producto aplicando whitelist de campos', async () => {
    productoModel.create.mockResolvedValue({ affectedRows: 1 });
    productoModel.getByAsin.mockResolvedValue({ asin: 'A1', product_title: 'T' });

    const product = await service.create({
      asin: 'A1',
      currency: 'USD',
      product_price: 10,
      product_title: 'T',
      columna_inyectada: 'x',
    });

    expect(product).toEqual({ asin: 'A1', product_title: 'T' });
    const payload = productoModel.create.mock.calls[0][0];
    expect(payload.columna_inyectada).toBeUndefined();
    expect(payload.asin).toBe('A1');
  });

  it('traduce el duplicado de asin a un error 409', async () => {
    productoModel.create.mockRejectedValue({ code: 'ER_DUP_ENTRY' });

    await expect(
      service.create({ asin: 'A1', currency: 'USD', product_price: 1, product_title: 'T' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('actualiza un producto existente sin permitir cambiar el asin', async () => {
    productoModel.getByAsin.mockResolvedValue({ asin: 'A1', product_title: 'T' });
    productoModel.update.mockResolvedValue({ affectedRows: 1 });

    await service.update('A1', { product_title: 'Nuevo', asin: 'OTRO' });

    const [, payload] = productoModel.update.mock.calls[0];
    expect(payload.asin).toBeUndefined();
    expect(payload.product_title).toBe('Nuevo');
  });

  it('lanza 404 si la actualización no afecta filas', async () => {
    productoModel.getByAsin.mockResolvedValue({ asin: 'A1' });
    productoModel.update.mockResolvedValue({ affectedRows: 0 });

    await expect(service.update('A1', { product_title: 'X' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('elimina un producto existente', async () => {
    productoModel.remove.mockResolvedValue({ affectedRows: 1 });

    await expect(service.remove('A1')).resolves.toBeUndefined();
  });

  it('lanza 404 si la eliminación no afecta filas', async () => {
    productoModel.remove.mockResolvedValue({ affectedRows: 0 });

    await expect(service.remove('A1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
