'use strict';

const ProductosService = require('../../../src/services/productos.service');
const { PAGINATION } = require('../../../src/config/constants');

/**
 * Crea un modelo de productos simulado.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createProductoModelMock() {
  return {
    getAll: jest.fn(),
    getCountAll: jest.fn(),
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

  it('lista productos devolviendo el listado, el total, la página y el total de páginas', async () => {
    productoModel.getAll.mockResolvedValue([{ asin: 'A1' }]);
    productoModel.getCountAll.mockResolvedValue(25);

    const result = await service.list({ search: null, page: 1, limit: 10 });

    expect(result).toEqual({ data: [{ asin: 'A1' }], totProd: 25, totPages: 3 });
    expect(productoModel.getAll).toHaveBeenCalledWith(null, 1, 10);
    expect(productoModel.getCountAll).toHaveBeenCalledWith(null);
  });

  it('calcula el total de páginas redondeando hacia arriba', async () => {
    productoModel.getAll.mockResolvedValue([]);
    productoModel.getCountAll.mockResolvedValue(21);

    const result = await service.list({ search: null, page: 1, limit: 10 });

    expect(result.totPages).toBe(3);
  });

  it('devuelve cero páginas cuando no hay productos', async () => {
    productoModel.getAll.mockResolvedValue([]);
    productoModel.getCountAll.mockResolvedValue(0);

    const result = await service.list({ search: null, page: 1, limit: 10 });

    expect(result.totPages).toBe(0);
  });

  it('propaga el término de búsqueda al modelo', async () => {
    productoModel.getAll.mockResolvedValue([]);
    productoModel.getCountAll.mockResolvedValue(0);

    const result = await service.list({ search: 'zapatilla', page: 3, limit: 5 });

    expect(result).toEqual({ data: [], totProd: 0, totPages: 0 });
    expect(productoModel.getAll).toHaveBeenCalledWith('zapatilla', 3, 5);
    expect(productoModel.getCountAll).toHaveBeenCalledWith('zapatilla');
  });

  it('aplica la paginación por defecto cuando no se indica', async () => {
    productoModel.getAll.mockResolvedValue([]);
    productoModel.getCountAll.mockResolvedValue(0);

    const result = await service.list({});

    expect(productoModel.getAll).toHaveBeenCalledWith(
      null,
      PAGINATION.DEFAULT_PAGE,
      PAGINATION.DEFAULT_LIMIT,
    );
  });

  it('propaga el error del modelo al listar', async () => {
    productoModel.getAll.mockRejectedValue(new Error('db error'));

    await expect(service.list({ search: null, page: 1, limit: 10 })).rejects.toThrow('db error');
  });

  describe('calculateTotalPages', () => {
    it('devuelve el total de páginas redondeando hacia arriba', () => {
      expect(service.calculateTotalPages(25, 10)).toBe(3);
      expect(service.calculateTotalPages(20, 10)).toBe(2);
      expect(service.calculateTotalPages(1, 10)).toBe(1);
    });

    it('devuelve 0 cuando el tamaño de página no es válido', () => {
      expect(service.calculateTotalPages(25, 0)).toBe(0);
      expect(service.calculateTotalPages(25, -5)).toBe(0);
    });
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
