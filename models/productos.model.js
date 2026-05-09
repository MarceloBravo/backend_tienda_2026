const cnn = require('../db/connection');

class ProductoModel {
    constructor() {
        this.db = cnn;
    }

    async getProductsAll(search = null, page, limit) {
        let query = 'SELECT * FROM productos';
        const params = [];
        const searchableFields = ['asin', 'product_title', 'product_badge', 'sales_volume'];

        if (search && search.trim().length > 0) {
            const conditions = searchableFields.map(field => `${field} LIKE ?`);
            query += ' WHERE ' + conditions.join(' OR ');
            params.push(...Array(searchableFields.length).fill(`%${search}%`));
        }

        query += ' LIMIT ? OFFSET ?';
        params.push(limit);
        params.push((page - 1) * limit);
        const [rows] = await cnn.query(query, params);
        return rows;
    }

    async getProductByAsin(asin) {
        const [rows] = await cnn.query('SELECT * FROM productos WHERE asin = ?', [asin]);
        return rows[0];
    }

    async createProduct(data) {
        const [result] = await cnn.query('INSERT INTO productos SET ?', [data]);
        if (result.affectedRows === 1) {
            return await this.getProductByAsin(data.asin);
        }
        return result;
    }

    async updateProduct(asin, data) {
        const [result] = await cnn.query('UPDATE productos SET ? WHERE asin = ?', [data, asin]);
        if (result.affectedRows === 1) {
            return await this.getProductByAsin(asin);
        }
        return { message: "Product not found or not updated" };
    }

    async deleteProduct(asin) {
        const [result] = await cnn.query('DELETE FROM productos WHERE asin = ?', [asin]);
        return result;
    }
}

module.exports = ProductoModel;