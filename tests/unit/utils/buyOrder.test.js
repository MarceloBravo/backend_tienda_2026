'use strict';

const {
  BUY_ORDER_MAX_LENGTH,
  generarBuyOrder,
  generarBuyOrderIntento,
} = require('../../../src/utils/buyOrder');

describe('utils/buyOrder', () => {
  it('genera buy orders únicos con el prefijo esperado', () => {
    const primero = generarBuyOrder();
    const segundo = generarBuyOrder();

    expect(primero.startsWith('ORD-')).toBe(true);
    expect(primero).not.toBe(segundo);
    expect(primero.length).toBeLessThanOrEqual(BUY_ORDER_MAX_LENGTH);
  });

  it('deriva un buy order de intento sin superar el máximo de Webpay', () => {
    const intento = generarBuyOrderIntento('ORD-ABC-12345678');

    expect(intento.startsWith('ORD-ABC-12345678')).toBe(true);
    expect(intento.length).toBeLessThanOrEqual(BUY_ORDER_MAX_LENGTH);
  });

  it('genera un buy order de intento distinto en cada llamada', () => {
    const primero = generarBuyOrderIntento('ORD-1');
    const segundo = generarBuyOrderIntento('ORD-1');

    expect(primero).not.toBe(segundo);
  });

  it('genera un buy order de intento aunque no reciba base', () => {
    const intento = generarBuyOrderIntento();

    expect(intento.length).toBeGreaterThan(0);
    expect(intento.length).toBeLessThanOrEqual(BUY_ORDER_MAX_LENGTH);
  });
});
