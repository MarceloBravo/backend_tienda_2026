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
    obtenerPorBuyOrder: jest.fn(),
    actualizarEstado: jest.fn(),
    liberarStockDeOrden: jest.fn().mockResolvedValue({ actualizada: true, estado: 'CANCELADO' }),
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
    obtenerPorBuyOrder: jest.fn(),
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
    transaction = { create: jest.fn(), commit: jest.fn(), status: jest.fn() };
    getWebpayTransaction.mockReturnValue(transaction);
    service = new TransbankService(ordenesModel, pagosModel);
  });

  describe('iniciarTransaccion', () => {
    const orden = { id: 1, buy_order: 'ORD-1', session_id: 'S-1', monto_total: 1000 };

    it('crea la transacción con un buy_order nuevo por intento', async () => {
      transaction.create.mockResolvedValue({ token: 'tok', url: 'https://webpay' });

      const result = await service.iniciarTransaccion(orden);

      expect(result.url).toBe('https://webpay');
      expect(result.token).toBe('tok');
      expect(result.amount).toBe(1000);
      expect(result.buyOrder).not.toBe('ORD-1');
      expect(result.buyOrder.startsWith('ORD-1')).toBe(true);
      expect(result.buyOrder.length).toBeLessThanOrEqual(26);
      expect(transaction.create).toHaveBeenCalledWith(
        result.buyOrder,
        'S-1',
        1000,
        'http://localhost:3000/api/pagos/retorno',
      );
      expect(pagosModel.crearOActualizarAlIniciar).toHaveBeenCalledWith({
        ordenId: 1,
        tokenWs: 'tok',
        buyOrder: result.buyOrder,
        sessionId: 'S-1',
        amount: 1000,
      });
    });

    it('genera un buy_order distinto en cada intento', async () => {
      transaction.create.mockResolvedValue({ token: 'tok', url: 'https://webpay' });

      const primero = await service.iniciarTransaccion(orden);
      const segundo = await service.iniciarTransaccion(orden);

      expect(primero.buyOrder).not.toBe(segundo.buyOrder);
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

  describe('consultarEstadoTransaccion', () => {
    it('delega en transaction.status', async () => {
      transaction.status.mockResolvedValue({ status: 'AUTHORIZED', response_code: 0 });

      const result = await service.consultarEstadoTransaccion('tok');

      expect(transaction.status).toHaveBeenCalledWith('tok');
      expect(result.status).toBe('AUTHORIZED');
    });

    it('envuelve fallos del SDK en un AppError', async () => {
      transaction.status.mockRejectedValue(new Error('network'));

      await expect(service.consultarEstadoTransaccion('tok')).rejects.toThrow(
        'No se pudo consultar el estado de la transacción con Transbank.',
      );
    });

    it('rechaza un token vacío', async () => {
      await expect(service.consultarEstadoTransaccion()).rejects.toThrow(
        'Token de transacción requerido.',
      );
    });
  });

  describe('cancelarTransaccion', () => {
    it('marca pago como ERROR y orden como CANCELADO cuando no está autorizada', async () => {
      pagosModel.obtenerPorToken.mockResolvedValue({
        orden_id: 20,
        buy_order: 'ORD-20',
        amount: 300,
        status: 'INICIADO',
      });
      transaction.status.mockResolvedValue({ status: 'FAILED', response_code: -1 });

      const result = await service.cancelarTransaccion('tok');

      expect(result.cancelado).toBe(true);
      expect(pagosModel.actualizarEstado).toHaveBeenCalledWith(20, 'ERROR');
      expect(ordenesModel.liberarStockDeOrden).toHaveBeenCalledWith(20, 'CANCELADO');
      expect(ordenesModel.actualizarEstado).not.toHaveBeenCalledWith(20, 'CANCELADO');
    });

    it('persiste el pago si el estado real está autorizado', async () => {
      const pago = { orden_id: 21, buy_order: 'ORD-21', amount: 300, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.status.mockResolvedValue({
        status: 'AUTHORIZED',
        response_code: 0,
        buy_order: 'ORD-21',
        amount: 300,
      });
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 21, estado: 'PAGADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'AUTORIZADO' });

      const result = await service.cancelarTransaccion('tok');

      expect(result.autorizado).toBe(true);
      expect(result.cancelado).toBe(false);
      expect(pagosModel.actualizarConCommit).toHaveBeenCalled();
      expect(ordenesModel.actualizarEstado).toHaveBeenCalledWith(21, 'PAGADO');
      expect(ordenesModel.liberarStockDeOrden).not.toHaveBeenCalled();
    });

    it('busca el pago por buy_order si el token no coincide', async () => {
      pagosModel.obtenerPorToken.mockResolvedValue(null);
      pagosModel.obtenerPorBuyOrder.mockResolvedValue({
        orden_id: 22,
        buy_order: 'ORD-22',
        amount: 300,
        status: 'INICIADO',
      });
      transaction.status.mockResolvedValue({ status: 'FAILED', response_code: -1 });

      const result = await service.cancelarTransaccion('tok', 'ORD-22');

      expect(pagosModel.obtenerPorBuyOrder).toHaveBeenCalledWith('ORD-22');
      expect(result.ordenId).toBe(22);
    });

    it('rechaza una cancelación sin token', async () => {
      await expect(service.cancelarTransaccion()).rejects.toThrow(
        'Token de transacción requerido.',
      );
    });
  });

  describe('manejarTimeout', () => {
    it('marca TIMEOUT y CANCELADO cuando el pago no fue autorizado', async () => {
      const pago = {
        orden_id: 30,
        buy_order: 'ORD-30-1',
        amount: 700,
        token_ws: 'tok',
        status: 'INICIADO',
      };
      pagosModel.obtenerPorBuyOrder.mockResolvedValue(pago);
      transaction.status.mockResolvedValue({ status: 'FAILED', response_code: -1 });

      const result = await service.manejarTimeout({ buyOrder: 'ORD-30-1' });

      expect(result.timeout).toBe(true);
      expect(result.autorizado).toBe(false);
      expect(pagosModel.actualizarEstado).toHaveBeenCalledWith(30, 'TIMEOUT');
      expect(ordenesModel.liberarStockDeOrden).toHaveBeenCalledWith(30, 'CANCELADO');
    });

    it('persiste el pago si el estado real está autorizado', async () => {
      const pago = {
        orden_id: 31,
        buy_order: 'ORD-31-1',
        amount: 700,
        token_ws: 'tok',
        status: 'INICIADO',
      };
      pagosModel.obtenerPorBuyOrder.mockResolvedValue(pago);
      transaction.status.mockResolvedValue({
        status: 'AUTHORIZED',
        response_code: 0,
        buy_order: 'ORD-31-1',
        amount: 700,
      });
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 31, estado: 'PAGADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'AUTORIZADO' });

      const result = await service.manejarTimeout({ buyOrder: 'ORD-31-1' });

      expect(result.autorizado).toBe(true);
      expect(ordenesModel.actualizarEstado).toHaveBeenCalledWith(31, 'PAGADO');
      expect(pagosModel.actualizarEstado).not.toHaveBeenCalledWith(31, 'TIMEOUT');
      expect(ordenesModel.liberarStockDeOrden).not.toHaveBeenCalled();
    });

    it('cancela la orden cuando no existe pago pero sí la orden', async () => {
      pagosModel.obtenerPorBuyOrder.mockResolvedValue(null);
      ordenesModel.obtenerPorBuyOrder.mockResolvedValue({
        id: 32,
        buy_order: 'ORD-32',
        monto_total: 900,
      });

      const result = await service.manejarTimeout({ buyOrder: 'ORD-32' });

      expect(result.timeout).toBe(true);
      expect(ordenesModel.liberarStockDeOrden).toHaveBeenCalledWith(32, 'CANCELADO');
    });

    it('rechaza un timeout sin buy order', async () => {
      await expect(service.manejarTimeout({})).rejects.toThrow(
        'Buy order requerido para manejar el timeout.',
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
      expect(ordenesModel.liberarStockDeOrden).toHaveBeenCalledWith(11, 'RECHAZADO');
      expect(ordenesModel.actualizarEstado).not.toHaveBeenCalledWith(11, 'RECHAZADO');
    });

    it('exige status AUTHORIZED y response_code 0 para autorizar', async () => {
      const pago = { orden_id: 14, buy_order: 'ORD-14', amount: 500, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.commit.mockResolvedValue({ status: 'AUTHORIZED', response_code: -1 });
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 14, estado: 'RECHAZADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'RECHAZADO' });

      const result = await service.confirmarTransaccion('tok');

      expect(result.autorizado).toBe(false);
      expect(ordenesModel.liberarStockDeOrden).toHaveBeenCalledWith(14, 'RECHAZADO');
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

    it('reintenta liberar el stock cuando el pago ya está rechazado', async () => {
      const pago = { orden_id: 16, buy_order: 'ORD-16', amount: 500, status: 'RECHAZADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 16, estado: 'RECHAZADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue(pago);

      const result = await service.confirmarTransaccion('tok');

      expect(result.yaProcesado).toBe(true);
      expect(transaction.commit).not.toHaveBeenCalled();
      expect(ordenesModel.liberarStockDeOrden).toHaveBeenCalledWith(16, 'RECHAZADO');
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

    it('reconcilia con status cuando el commit falla y estaba autorizado', async () => {
      const pago = { orden_id: 13, buy_order: 'ORD-13', amount: 500, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.commit.mockRejectedValue(new Error('already committed'));
      transaction.status.mockResolvedValue({
        status: 'AUTHORIZED',
        response_code: 0,
        buy_order: 'ORD-13',
        amount: 500,
      });
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 13, estado: 'PAGADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'AUTORIZADO' });

      const result = await service.confirmarTransaccion('tok');

      expect(result.autorizado).toBe(true);
      expect(transaction.status).toHaveBeenCalledWith('tok');
      expect(ordenesModel.actualizarEstado).toHaveBeenCalledWith(13, 'PAGADO');
    });

    it('reconcilia como RECHAZADO cuando el commit falla y status es FAILED', async () => {
      const pago = { orden_id: 15, buy_order: 'ORD-15', amount: 500, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.commit.mockRejectedValue(new Error('already committed'));
      transaction.status.mockResolvedValue({ status: 'FAILED', response_code: -1 });
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 15, estado: 'RECHAZADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'RECHAZADO' });

      const result = await service.confirmarTransaccion('tok');

      expect(result.autorizado).toBe(false);
      expect(ordenesModel.liberarStockDeOrden).toHaveBeenCalledWith(15, 'RECHAZADO');
    });

    it('devuelve el estado persistido si el commit y status fallan', async () => {
      const pago = { orden_id: 16, buy_order: 'ORD-16', amount: 500, status: 'INICIADO' };
      pagosModel.obtenerPorToken.mockResolvedValue(pago);
      transaction.commit.mockRejectedValue(new Error('already committed'));
      transaction.status.mockRejectedValue(new Error('network'));
      ordenesModel.obtenerPorId.mockResolvedValue({ id: 16, estado: 'PAGADO' });
      pagosModel.obtenerPorOrdenId.mockResolvedValue({ ...pago, status: 'AUTORIZADO' });

      const result = await service.confirmarTransaccion('tok');

      expect(result.yaProcesado).toBe(true);
      expect(result.autorizado).toBe(true);
    });
  });
});
