'use strict';

jest.mock('../../../src/config/transbank', () => ({
  getWebpayTransaction: jest.fn(),
  getReturnUrl: jest.fn(() => 'http://localhost:3000/api/pagos/retorno'),
}));

const { getWebpayTransaction } = require('../../../src/config/transbank');
const TransbankService = require('../../../src/services/transbank.service');

/**
 * Crea un modelo de órdenes simulado.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createOrdenesModelMock() {
  return {
    obtenerPorId: jest.fn(),
    actualizarEstado: jest.fn(),
  };
}

/**
 * Crea un modelo de pagos simulado.
 *
 * @returns {object} Modelo con funciones `jest.fn`.
 */
function createPagosModelMock() {
  return {
    crearOActualizarAlIniciar: jest.fn(),
    obtenerPorToken: jest.fn(),
    obtenerPorOrdenId: jest.fn(),
    actualizarConCommit: jest.fn(),
    actualizarEstado: jest.fn(),
  };
}

describe('TransbankService', () => {
  let ordenesModel;
  let pagosModel;
  let transaction;
  let service;

  beforeEach(() => {
    ordenesModel = createOrdenesModelMock();
    pagosModel = createPagosModelMock();
    transaction = { create: jest.fn(), commit: jest.fn() };
    getWebpayTransaction.mockReturnValue(transaction);
    service = new TransbankService(ordenesModel, pagosModel);
  });

  describe('iniciarTransaccion', () => {
    const orden = { id: 1, buy_order: 'ORD-1', session_id: 'S-1', monto_total: 1000 };

    it('crea la transacción y persiste el pago iniciado', async () => {
      transaction.create.mockResolvedValue({ token: 'tok', url: 'https://webpay' });

      const result = await service.iniciarTransaccion(orden);

      expect(result).toEqual({
        url: 'https://webpay',
        token: 'tok',
        buyOrder: 'ORD-1',
        amount: 1000,
      });
      expect(pagosModel.crearOActualizarAlIniciar).toHaveBeenCalledWith({
        ordenId: 1,
        tokenWs: 'tok',
        buyOrder: 'ORD-1',
        sessionId: 'S-1',
        amount: 1000,
      });
    });

    it('rechaza órdenes con datos incompletos', async () => {
      await expect(service.iniciarTransaccion({ id: 1 })).rejects.toThrow(
        'Datos de orden incompletos',
      );
    });

    it('rechaza respuestas inválidas del SDK', async () => {
      transaction.create.mockResolvedValue({});

      await expect(service.iniciarTransaccion(orden)).rejects.toThrow(
        'No se pudo iniciar la transacción con Transbank.',
      );
    });

    it('envuelve errores del SDK en un AppError', async () => {
      transaction.create.mockRejectedValue(new Error('network'));

      await expect(service.iniciarTransaccion(orden)).rejects.toThrow(
        'Error al iniciar transacción con Transbank.',
      );
    });
  });

  describe('cancelarTransaccion', () => {
    it('marca pago como ERROR y orden como CANCELADO', async () => {
      pagosModel.obtenerPorToken.mockResolvedValue({
        orden_id: 20,
        buy_order: 'ORD-20',
        amount: 300,
      });

      const result = await service.cancelarTransaccion('tok');

      expect(result.cancelado).toBe(true);
      expect(pagosModel.actualizarEstado).toHaveBeenCalledWith(20, 'ERROR');
      expect(ordenesModel.actualizarEstado).toHaveBeenCalledWith(20, 'CANCELADO');
    });

    it('rechaza una cancelación sin token', async () => {
      await expect(service.cancelarTransaccion()).rejects.toThrow(
        'Token de transacción requerido.',
      );
    });
  });

  describe('confirmarTransaccion', () => {
    it('marca la orden como PAGADO cuando el pago es autorizado', async () => {
      const pago = { orden_id: 10, buy_order: 'ORD-10', amount: 500, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.commit.mockResolvedValue({
        status: 'AUTHORIZED',
        response_code: 0,
        buy_order: 'ORD-10',
        amount: 500,
        authorization_code: 'AUTH',
      });
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 10, estado: 'PAGADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'AUTORIZADO' });

      const result = await service.confirmarTransaccion('tok');

      expect(result.autorizado).toBe(true);
      expect(result.yaProcesado).toBe(false);
      expect(ordenesModel.actualizarEstado).toHaveBeenCalledWith(10, 'PAGADO');
    });

    it('marca la orden como RECHAZADO cuando el pago no es autorizado', async () => {
      const pago = { orden_id: 11, buy_order: 'ORD-11', amount: 500, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.commit.mockResolvedValue({ status: 'FAILED', response_code: -1 });
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 11, estado: 'RECHAZADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'RECHAZADO' });

      const result = await service.confirmarTransaccion('tok');

      expect(result.autorizado).toBe(false);
      expect(ordenesModel.actualizarEstado).toHaveBeenCalledWith(11, 'RECHAZADO');
    });

    it('es idempotente cuando el pago ya está autorizado', async () => {
      const pago = { orden_id: 12, buy_order: 'ORD-12', amount: 500, status: 'AUTORIZADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 12, estado: 'PAGADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue(pago);

      const result = await service.confirmarTransaccion('tok');

      expect(result.yaProcesado).toBe(true);
      expect(transaction.commit).not.toHaveBeenCalled();
    });

    it('rechaza un token inexistente', async () => {
      pagosModel.obtenerPorToken.mockResolvedValue(null);

      await expect(service.confirmarTransaccion('tok')).rejects.toThrow(
        'Transacción no encontrada.',
      );
    });

    it('rechaza un token vacío', async () => {
      await expect(service.confirmarTransaccion()).rejects.toThrow(
        'Token de transacción requerido.',
      );
    });

    it('retorna el estado persistido si el commit falla (doble retorno)', async () => {
      const pago = { orden_id: 13, buy_order: 'ORD-13', amount: 500, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.commit.mockRejectedValue(new Error('already committed'));
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 13, estado: 'PAGADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'AUTORIZADO' });

      const result = await service.confirmarTransaccion('tok');

      expect(result.yaProcesado).toBe(true);
      expect(result.autorizado).toBe(true);
    });
  });
});
