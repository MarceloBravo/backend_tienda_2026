'use strict';

const {
  ESTADOS_PAGO,
  esCodigoAprobado,
  esTransaccionAutorizada,
  determinarEstadoPago,
} = require('../../../src/utils/transbank');

describe('utils/transbank', () => {
  describe('esCodigoAprobado', () => {
    it('acepta 0 numérico y su representación en cadena', () => {
      expect(esCodigoAprobado(0)).toBe(true);
      expect(esCodigoAprobado('0')).toBe(true);
    });

    it('rechaza valores vacíos o distintos de 0', () => {
      expect(esCodigoAprobado(null)).toBe(false);
      expect(esCodigoAprobado(undefined)).toBe(false);
      expect(esCodigoAprobado('')).toBe(false);
      expect(esCodigoAprobado(-1)).toBe(false);
    });
  });

  describe('esTransaccionAutorizada', () => {
    it('exige status AUTHORIZED y response_code 0', () => {
      expect(esTransaccionAutorizada({ status: 'AUTHORIZED', response_code: 0 })).toBe(true);
    });

    it('rechaza AUTHORIZED con response_code distinto de 0', () => {
      expect(esTransaccionAutorizada({ status: 'AUTHORIZED', response_code: -1 })).toBe(false);
    });

    it('rechaza response_code 0 con status distinto de AUTHORIZED', () => {
      expect(esTransaccionAutorizada({ status: 'FAILED', response_code: 0 })).toBe(false);
    });

    it('rechaza respuestas vacías', () => {
      expect(esTransaccionAutorizada(null)).toBe(false);
      expect(esTransaccionAutorizada(undefined)).toBe(false);
    });
  });

  describe('determinarEstadoPago', () => {
    it('devuelve AUTORIZADO solo si ambas condiciones se cumplen', () => {
      expect(determinarEstadoPago({ status: 'AUTHORIZED', response_code: 0 })).toBe(
        ESTADOS_PAGO.AUTORIZADO,
      );
    });

    it('devuelve RECHAZADO cuando status es FAILED', () => {
      expect(determinarEstadoPago({ status: 'FAILED', response_code: -1 })).toBe(
        ESTADOS_PAGO.RECHAZADO,
      );
    });

    it('devuelve RECHAZADO cuando el response_code no es 0', () => {
      expect(determinarEstadoPago({ status: 'AUTHORIZED', response_code: -1 })).toBe(
        ESTADOS_PAGO.RECHAZADO,
      );
    });

    it('devuelve INICIADO cuando no hay información suficiente', () => {
      expect(determinarEstadoPago(null)).toBe(ESTADOS_PAGO.INICIADO);
      expect(determinarEstadoPago({ status: null, response_code: 0 })).toBe(ESTADOS_PAGO.INICIADO);
    });
  });
});
