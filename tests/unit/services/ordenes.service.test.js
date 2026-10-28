'use strict';

const OrdenesService = require('../../../src/services/ordenes.service');

/**
 * Crea un modelo de órdenes simulado.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createOrdenesModelMock() {
  return {
    crearOrdenConDetalle: jest.fn(),
    obtenerPorId: jest.fn(),
    obtenerDetalle: jest.fn(),
    actualizarEstado: jest.fn(),
  };
}

/**
 * Crea un modelo de productos simulado.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createProductosModelMock() {
  return {
    getByAsin: jest.fn(),
  };
}

describe('OrdenesService', () => {
  let ordenesModel;
  let productosModel;
  let service;

  beforeEach(() => {
    ordenesModel = createOrdenesModelMock();
    productosModel = createProductosModelMock();
    service = new OrdenesService(ordenesModel, productosModel);
  });

  it('crea una orden calculando montos desde la base de datos', async () => {
    productosModel.getByAsin.mockResolvedValue({
      asin: 'A1',
      product_price: '100.50',
      stock: 10,
      product_title: 'Producto A',
    });
    ordenesModel.crearOrdenConDetalle.mockImplementation(async (data) => ({
      ...data,
      id: 7,
      estado: 'PENDIENTE',
    }));

    const result = await service.crearOrden({
      usuarioId: 3,
      items: [{ asin: 'A1', cantidad: 2 }],
      direccionEnvio: 'Calle 1',
    });

    expect(result.ordenId).toBe(7);
    expect(result.montoTotal).toBe(201);
    expect(result.items[0]).toMatchObject({
      asin: 'A1',
      cantidad: 2,
      precioUnitario: 100.5,
      subtotal: 201,
    });
    expect(ordenesModel.crearOrdenConDetalle).toHaveBeenCalledTimes(1);
  });

  it('rechaza un carrito vacío', async () => {
    await expect(service.crearOrden({ usuarioId: 1, items: [] })).rejects.toThrow(
      'El carrito está vacío.',
    );
  });

  it('rechaza cantidades inválidas', async () => {
    await expect(
      service.crearOrden({ usuarioId: 1, items: [{ asin: 'A1', cantidad: 0 }] }),
    ).rejects.toThrow('Cantidad inválida');
  });

  it('rechaza productos inexistentes', async () => {
    productosModel.getByAsin.mockResolvedValue(undefined);

    await expect(
      service.crearOrden({ usuarioId: 1, items: [{ asin: 'NOPE', cantidad: 1 }] }),
    ).rejects.toThrow('no encontrado');
  });

  it('rechaza stock insuficiente', async () => {
    productosModel.getByAsin.mockResolvedValue({ asin: 'A1', product_price: '10', stock: 1 });

    await expect(
      service.crearOrden({ usuarioId: 1, items: [{ asin: 'A1', cantidad: 2 }] }),
    ).rejects.toThrow('Stock insuficiente');
  });

  it('valida la pertenencia de la orden al usuario', async () => {
    ordenesModel.obtenerPorId.mockResolvedValue({ id: 1, usuario_id: 5 });
    ordenesModel.obtenerDetalle.mockResolvedValue([]);

    await expect(service.validarPertenencia(1, 9)).rejects.toThrow('No autorizado');
  });

  it('lanza 404 al obtener una orden inexistente', async () => {
    ordenesModel.obtenerPorId.mockResolvedValue(null);

    await expect(service.obtenerOrden(1)).rejects.toThrow('Orden no encontrada.');
  });
});
