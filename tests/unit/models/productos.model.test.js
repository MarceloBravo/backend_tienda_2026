'use strict';

const ProductoModel = require('../../../src/models/productos.model');

/**
 * Crea un adaptador de base de datos simulado que registra las consultas.
 *
 * @param {Array<*>} [rows=[]] Filas devueltas por la consulta.
 * @returns {object} Adaptador con la función `query` simulada.
 */
function createDbMock(rows = []) {
  return {
    query: jest.fn().mockResolvedValue([rows, []]),
  };
}

describe('ProductoModel', () => {
  let db;
  let model;

  beforeEach(() => {
    db = createDbMock();
    model = new ProductoModel(db);
  });

  describe('getAll', () => {
    it('consulta los productos con paginación y sin búsqueda', async () => {
      db.query.mockResolvedValue([[{ asin: 'A1' }], []]);

      const rows = await model.getAll(null, 2, 10);

      expect(rows).toEqual([{ asin: 'A1' }]);
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM productos LIMIT ? OFFSET ?', [10, 10]);
    });

    it('añade el filtro de búsqueda con sus parámetros', async () => {
      await model.getAll('zapatilla', 1, 10);

      const [query, params] = db.query.mock.calls[0];
      expect(query).toBe(
        'SELECT * FROM productos WHERE asin LIKE ? OR product_title LIKE ? OR product_badge LIKE ? OR sales_volume LIKE ? LIMIT ? OFFSET ?',
      );
      expect(params).toEqual(['%zapatilla%', '%zapatilla%', '%zapatilla%', '%zapatilla%', 10, 0]);
    });

    it('ignora búsquedas vacías o en blanco', async () => {
      await model.getAll('   ', 1, 10);

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM productos LIMIT ? OFFSET ?', [10, 0]);
    });

    it('propaga el error de la base de datos', async () => {
      db.query.mockRejectedValue(new Error('db error'));

      await expect(model.getAll(null, 1, 10)).rejects.toThrow('db error');
    });
  });

  describe('getCountAll', () => {
    it('devuelve el total de productos de la tabla', async () => {
      db.query.mockResolvedValue([[{ total: 42 }], []]);

      const total = await model.getCountAll(null);

      expect(total).toBe(42);
      expect(db.query).toHaveBeenCalledWith('SELECT COUNT(*) AS total FROM productos', []);
    });

    it('aplica el mismo filtro de búsqueda que el listado', async () => {
      db.query.mockResolvedValue([[{ total: 7 }], []]);

      const total = await model.getCountAll('zapatilla');

      expect(total).toBe(7);
      const [query, params] = db.query.mock.calls[0];
      expect(query).toBe(
        'SELECT COUNT(*) AS total FROM productos WHERE asin LIKE ? OR product_title LIKE ? OR product_badge LIKE ? OR sales_volume LIKE ?',
      );
      expect(params).toEqual(['%zapatilla%', '%zapatilla%', '%zapatilla%', '%zapatilla%']);
    });

    it('devuelve 0 cuando el conteo no trae filas', async () => {
      db.query.mockResolvedValue([[], []]);

      await expect(model.getCountAll(null)).resolves.toBe(0);
    });

    it('propaga el error de la base de datos', async () => {
      db.query.mockRejectedValue(new Error('db error'));

      await expect(model.getCountAll(null)).rejects.toThrow('db error');
    });
  });

  describe('buildSearchFilter', () => {
    it('devuelve una cláusula vacía cuando no hay búsqueda', () => {
      expect(model.buildSearchFilter(null)).toEqual({ clause: '', params: [] });
      expect(model.buildSearchFilter('')).toEqual({ clause: '', params: [] });
    });

    it('devuelve la cláusula y los parámetros de la búsqueda', () => {
      const { clause, params } = model.buildSearchFilter('abc');

      expect(clause).toContain('WHERE asin LIKE ?');
      expect(params).toHaveLength(4);
    });
  });
});
