'use strict';

const TransbankController = require('../../../src/controllers/transbank.controller');

/**
 * Crea una respuesta HTTP simulada.
 *
 * @returns {object} Objeto `res` con `status`, `json` y `redirect` simulados.
 */
function createResMock() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
}

describe('TransbankController', () => {
  let ordenesService;
  let transbankService;
  let pagosModel;
  let controller;

  beforeEach(() => {
    ordenesService = {
      crearOrden: jest.fn(),
      validarPertenencia: jest.fn(),
    };
    transbankService = {
      iniciarTransaccion: jest.fn(),
      confirmarTransaccion: jest.fn(),
      cancelarTransaccion: jest.fn(),
    };
    pagosModel = { obtenerPorOrdenId: jest.fn() };
    controller = new TransbankController(ordenesService, transbankService, pagosModel);
  });

  it('crea una orden usando el usuario autenticado', async () => {
    ordenesService.crearOrden.mockResolvedValue({ ordenId: 1 });
    const res = createResMock();

    await controller.crearOrden(
      { user: { id: 4 }, body: { items: [{ asin: 'A1', cantidad: 1 }] } },
      res,
    );

    expect(ordenesService.crearOrden).toHaveBeenCalledWith({
      usuarioId: 4,
      items: [{ asin: 'A1', cantidad: 1 }],
      direccionEnvio: null,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('inicia el pago de una orden validando pertenencia', async () => {
    ordenesService.validarPertenencia.mockResolvedValue({ id: 2 });
    transbankService.iniciarTransaccion.mockResolvedValue({ url: 'u', token: 't' });
    const res = createResMock();

    await controller.iniciarPago({ user: { id: 4 }, body: { ordenId: 2 } }, res);

    expect(ordenesService.validarPertenencia).toHaveBeenCalledWith(2, 4);
    expect(transbankService.iniciarTransaccion).toHaveBeenCalledWith({ id: 2 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('redirige al frontend en el retorno cuando el cliente acepta HTML', async () => {
    transbankService.confirmarTransaccion.mockResolvedValue({
      autorizado: true,
      buyOrder: 'B',
      ordenId: 3,
    });
    process.env.FRONTEND_URL = 'https://frontend';
    const res = createResMock();
    const req = {
      body: { token_ws: 'tok' },
      query: {},
      accepts: jest.fn().mockReturnValue('html'),
    };

    await controller.retorno(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://frontend/pago/resultado?estado=success&buyOrder=B&ordenId=3',
    );
  });

  it('responde JSON en el retorno cuando no hay frontend configurado', async () => {
    delete process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL2;
    transbankService.confirmarTransaccion.mockResolvedValue({ autorizado: false });
    const res = createResMock();
    const req = { body: { token_ws: 'tok' }, query: {}, accepts: jest.fn() };

    await controller.retorno(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', message: 'Pago rechazado o no autorizado.' }),
    );
  });

  it('marca la transacción como cancelada cuando Transbank envía TBK_TOKEN', async () => {
    transbankService.cancelarTransaccion.mockResolvedValue({ autorizado: false, cancelado: true });
    const res = createResMock();
    const req = {
      body: { TBK_TOKEN: 'tok' },
      query: {},
      accepts: jest.fn().mockReturnValue('json'),
    };

    await controller.retorno(req, res);

    expect(transbankService.cancelarTransaccion).toHaveBeenCalledWith('tok');
    expect(transbankService.confirmarTransaccion).not.toHaveBeenCalled();
  });

  it('consulta el estado de la orden y su pago', async () => {
    ordenesService.validarPertenencia.mockResolvedValue({ id: 5 });
    pagosModel.obtenerPorOrdenId.mockResolvedValue({ status: 'AUTORIZADO' });
    const res = createResMock();

    await controller.estado({ params: { ordenId: '5' }, user: { id: 1 } }, res);

    expect(ordenesService.validarPertenencia).toHaveBeenCalledWith(5, 1);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Estado de la orden obtenido.',
      data: { orden: { id: 5 }, pago: { status: 'AUTORIZADO' } },
    });
  });
});
