'use strict';

const OrdenesModel = require('../../../src/models/ordenes.model');

/**
 * Crea una conexión transaccional simulada.
 *
 * @returns {object} Conexión con funciones `jest.fn`.
 */
function createConnectionMock() {
  return {
    beginTransaction: jest.fn().mockResolvedValue(),
    query: jest.fn(),
    commit: jest.fn().mockResolvedValue(),
    rollback: jest.fn().mockResolvedValue(),
    release: jest.fn(),
  };
}

/**
 * Crea un adaptador de base de datos que entrega la conexión simulada.
 *
 * @param {object} connection Conexión transaccional simulada.
 * @returns {object} Adaptador con `getConnection` simulado.
 */
function createDbMock(connection) {
  return { getConnection: jest.fn().mockResolvedValue(connection) };
}

/**
 * Configura respuestas de la conexión según fragmentos de SQL.
 *
 * @param {object} connection Conexión simulada.
 * @param {Array<[string, object]>} handlers Pares `[fragmento SQL, resultado]`.
 * @returns {void}
 */
function mockQueries(connection, handlers) {
  connection.query.mockImplementation(async (sql) => {
    for (const [fragment, result] of handlers) {
      if (sql.includes(fragment)) {
        return [result, []];
      }
    }
    return [{ affectedRows: 1 }, []];
  });
}

/**
 * Extrae las llamadas que descuentan stock.
 *
 * @param {object} connection Conexión simulada.
 * @returns {Array<Array<*>>} Argumentos de las llamadas de descuento.
 */
function obtenerDescuentosDeStock(connection) {
  return connection.query.mock.calls.filter(([sql]) => sql.includes('stock = stock - ?'));
}

describe('OrdenesModel', () => {
  let connection;
  let model;

  beforeEach(() => {
    connection = createConnectionMock();
    model = new OrdenesModel(createDbMock(connection));
  });

  describe('crearOrdenConDetalle', () => {
    const items = [
      { asin: 'B', productoId: 'B', cantidad: 1, precioUnitario: 10, subtotal: 10 },
      { asin: 'A', productoId: 'A', cantidad: 2, precioUnitario: 10, subtotal: 20 },
      { asin: 'A', productoId: 'A', cantidad: 1, precioUnitario: 10, subtotal: 10 },
    ];

    it('crea la orden y reserva el stock dentro de la misma transacción', async () => {
      mockQueries(connection, [['INSERT INTO ordenes', { insertId: 7 }]]);

      const result = await model.crearOrdenConDetalle({
        usuarioId: 1,
        buyOrder: 'ORD-1',
        sessionId: 'S-1',
        montoTotal: 40,
        items,
      });

      expect(result.id).toBe(7);
      expect(connection.beginTransaction).toHaveBeenCalled();
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.rollback).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();

      expect(obtenerDescuentosDeStock(connection)).toEqual([
        ['UPDATE productos SET stock = stock - ? WHERE asin = ? AND stock >= ?', [3, 'A', 3]],
        ['UPDATE productos SET stock = stock - ? WHERE asin = ? AND stock >= ?', [1, 'B', 1]],
      ]);
    });

    it('hace rollback cuando no hay stock suficiente', async () => {
      mockQueries(connection, [
        ['INSERT INTO ordenes', { insertId: 8 }],
        ['stock = stock - ?', { affectedRows: 0 }],
      ]);

      await expect(
        model.crearOrdenConDetalle({
          usuarioId: 1,
          buyOrder: 'ORD-2',
          sessionId: 'S-2',
          montoTotal: 10,
          items: [{ asin: 'A', cantidad: 1, precioUnitario: 10, subtotal: 10 }],
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Stock insuficiente para A.' });

      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.commit).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });

    it('hace rollback y propaga el error si falla una consulta', async () => {
      connection.query.mockRejectedValue(new Error('db error'));

      await expect(
        model.crearOrdenConDetalle({
          usuarioId: 1,
          buyOrder: 'ORD-3',
          sessionId: 'S-3',
          montoTotal: 10,
          items: [{ asin: 'A', cantidad: 1, precioUnitario: 10, subtotal: 10 }],
        }),
      ).rejects.toThrow('db error');

      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.commit).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });
  });

  describe('liberarStockDeOrden', () => {
    it('restaura el stock agrupado y deja la orden en el estado terminal', async () => {
      mockQueries(connection, [
        ['SELECT estado FROM ordenes', [{ estado: 'PENDIENTE' }]],
        [
          'SELECT COALESCE',
          [
            { asin: 'B', cantidad: 4 },
            { asin: 'A', cantidad: 2 },
            { asin: 'A', cantidad: 1 },
          ],
        ],
      ]);

      const result = await model.liberarStockDeOrden(7, 'RECHAZADO');

      expect(result).toEqual({ actualizada: true, estado: 'RECHAZADO' });
      expect(connection.beginTransaction).toHaveBeenCalled();
      expect(connection.commit).toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();

      const reposiciones = connection.query.mock.calls.filter(([sql]) =>
        sql.includes('stock = stock + ?'),
      );
      expect(reposiciones).toEqual([
        ['UPDATE productos SET stock = stock + ? WHERE asin = ?', [3, 'A']],
        ['UPDATE productos SET stock = stock + ? WHERE asin = ?', [4, 'B']],
      ]);
      expect(connection.query).toHaveBeenCalledWith('UPDATE ordenes SET estado = ? WHERE id = ?', [
        'RECHAZADO',
        7,
      ]);
    });

    it('no libera stock si la orden ya está en un estado terminal', async () => {
      mockQueries(connection, [['SELECT estado FROM ordenes', [{ estado: 'CANCELADO' }]]]);

      const result = await model.liberarStockDeOrden(7, 'CANCELADO');

      expect(result).toEqual({ actualizada: false, estado: 'CANCELADO' });
      expect(connection.query).not.toHaveBeenCalledWith(
        expect.stringContaining('stock = stock + ?'),
        expect.anything(),
      );
      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.commit).not.toHaveBeenCalled();
    });

    it('es idempotente ante una segunda liberación', async () => {
      let estado = 'PENDIENTE';
      connection.query.mockImplementation(async (sql, params) => {
        if (sql.includes('SELECT estado FROM ordenes')) {
          return [[{ estado }], []];
        }
        if (sql.includes('SELECT COALESCE')) {
          return [[{ asin: 'A', cantidad: 1 }], []];
        }
        if (sql.includes('UPDATE ordenes SET estado')) {
          estado = params[0];
        }
        return [{ affectedRows: 1 }, []];
      });

      const primera = await model.liberarStockDeOrden(7, 'CANCELADO');
      const segunda = await model.liberarStockDeOrden(7, 'CANCELADO');

      expect(primera.actualizada).toBe(true);
      expect(segunda.actualizada).toBe(false);
      expect(segunda.estado).toBe('CANCELADO');
    });

    it('devuelve no actualizada cuando la orden no existe', async () => {
      mockQueries(connection, [['SELECT estado FROM ordenes', []]]);

      const result = await model.liberarStockDeOrden(99, 'CANCELADO');

      expect(result).toEqual({ actualizada: false, estado: null });
      expect(connection.rollback).toHaveBeenCalled();
    });

    it('hace rollback y propaga el error si falla la transacción', async () => {
      connection.query.mockRejectedValue(new Error('db error'));

      await expect(model.liberarStockDeOrden(7, 'CANCELADO')).rejects.toThrow('db error');

      expect(connection.rollback).toHaveBeenCalled();
      expect(connection.commit).not.toHaveBeenCalled();
      expect(connection.release).toHaveBeenCalled();
    });
  });

  describe('agruparCantidadesPorAsin', () => {
    it('agrupa, convierte a número y ordena por ASIN', () => {
      expect(
        model.agruparCantidadesPorAsin([
          { asin: 'B', cantidad: '2' },
          { asin: 'A', cantidad: 1 },
          { asin: 'A', cantidad: 3 },
        ]),
      ).toEqual([
        { asin: 'A', cantidad: 4 },
        { asin: 'B', cantidad: 2 },
      ]);
    });

    it('rechaza cantidades inválidas', () => {
      expect(() => model.agruparCantidadesPorAsin([{ asin: 'A', cantidad: 0 }])).toThrow(
        'Cantidad inválida en el carrito.',
      );
    });
  });
});
