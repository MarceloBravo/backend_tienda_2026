'use strict';

const ProductosController = require('../../../src/controllers/productos.controller');

/**
 * Crea un servicio de productos simulado con el listado paginado por defecto.
 *
 * @returns {object} Servicio con funciones `jest.fn`.
 */
function createServiceMock() {
  return {
    list: jest.fn().mockResolvedValue({ data: [{ asin: 'A1' }], totProd: 1, page: 1, totPages: 1 }),
    getByAsin: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
}

/**
 * Crea una respuesta HTTP simulada que registra el estado y el cuerpo enviados.
 *
 * @returns {object} Objeto `res` con `status` y `json` simulados.
 */
function createResMock() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ProductosController', () => {
  let productosService;
  let controller;

  beforeEach(() => {
    productosService = createServiceMock();
    controller = new ProductosController(productosService);
  });

  describe('getAllProducts', () => {
    it('responde con data, totProd, page y totPages en la raíz', async () => {
      const res = createResMock();

      await controller.getAllProducts({ query: { page: 1, limit: 10 } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: [{ asin: 'A1' }],
        totProd: 1,
        page: 1,
        totPages: 1,
      });
    });

    it('envía los parámetros de consulta al servicio', async () => {
      const res = createResMock();

      await controller.getAllProducts({ query: { search: 'zapatilla', page: 2, limit: 5 } }, res);

      expect(productosService.list).toHaveBeenCalledWith({
        search: 'zapatilla',
        page: 2,
        limit: 5,
      });
    });

    it('devuelve la página actual o solicitada informada por el servicio', async () => {
      productosService.list.mockResolvedValue({ data: [], totProd: 0, page: 7, totPages: 0 });
      const res = createResMock();

      await controller.getAllProducts({ query: { page: 7, limit: 10 } }, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: [],
        totProd: 0,
        page: 7,
        totPages: 0,
      });
    });

    it('propaga el error del servicio', async () => {
      productosService.list.mockRejectedValue(new Error('db error'));
      const res = createResMock();

      await expect(controller.getAllProducts({ query: {} }, res)).rejects.toThrow('db error');
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('getProductByAsin', () => {
    it('responde con el producto en el campo data', async () => {
      productosService.getByAsin.mockResolvedValue({ asin: 'A1' });
      const res = createResMock();

      await controller.getProductByAsin({ params: { id: 'A1' } }, res);

      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { asin: 'A1' } });
    });
  });

  describe('createProduct', () => {
    it('responde 201 con el producto creado', async () => {
      productosService.create.mockResolvedValue({ asin: 'A1' });
      const res = createResMock();

      await controller.createProduct({ body: { asin: 'A1' }, file: undefined }, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Producto creado exitosamente.',
        data: { asin: 'A1' },
      });
    });

    it('adjunta la ruta de la imagen subida al payload', async () => {
      productosService.create.mockResolvedValue({ asin: 'A1' });
      const res = createResMock();

      await controller.createProduct(
        { body: { asin: 'A1' }, file: { path: 'uploads/a1.png' } },
        res,
      );

      expect(productosService.create).toHaveBeenCalledWith({
        asin: 'A1',
        product_photo: 'uploads/a1.png',
      });
    });
  });

  describe('updateProduct', () => {
    it('responde con el producto actualizado', async () => {
      productosService.update.mockResolvedValue({ asin: 'A1', product_title: 'Nuevo' });
      const res = createResMock();

      await controller.updateProduct({ params: { id: 'A1' }, body: {}, file: undefined }, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Producto actualizado exitosamente.',
        data: { asin: 'A1', product_title: 'Nuevo' },
      });
    });
  });

  describe('deleteProduct', () => {
    it('responde con el mensaje de confirmación', async () => {
      productosService.remove.mockResolvedValue(undefined);
      const res = createResMock();

      await controller.deleteProduct({ params: { id: 'A1' } }, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Producto eliminado exitosamente.',
      });
    });
  });
});
