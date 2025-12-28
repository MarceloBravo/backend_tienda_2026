const ProductoModel = require('../models/productos.model');

class ProductoController{
    constructor(){
        this.productModel = new ProductoModel();
    }

    async getAllProducts(req, res, next){
        try {
            const search = req.query.search; // Extraer el parámetro de búsqueda
            const products = await this.productModel.getProductsAll(search);
            res.json({data: products});
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async getProductByAsin(req, res, next){
        try {
            const asin = req.params.id;
            const product = await this.productModel.getProductByAsin(asin);
            res.json({data: product});
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async createProduct(req, res, next){
        try {
            const data = req.body;
            if(req.file){
                data.product_photo = req.file.path;
            }
            const result = await this.productModel.createProduct(data);
            if(result && result.affectedRows === 1){
                const product = await this.productModel.getProductById(result.insertId);
                return res.json({mensaje: 'Producto creado exitosamente.',data: product});
            }else{
                res.json({error: 'No se pudo crear el producto.'});
            }
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async updateProduct(req, res, next){
        try {
            debugger
            const asin = req.params.id;
            const data = req.body;
            if(req.file){
                data.product_photo = req.file.path;
            }
            const result = await this.productModel.updateProduct(asin, data);
            if(result && result.affectedRows === 1){
                const product = await this.productModel.getProductByAsin(asin);
                return res.json({mensaje: 'Producto actualizado exitosamente.',data: product});
            }else{
                res.json({error: 'No se pudo actualizar el producto.'});
            }
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async deleteProduct(req, res, next){
        try {
            const asin = req.params.id;
            const result = await this.productModel.deleteProduct(asin);
            if(result && result.affectedRows === 1){
                return res.json({mensaje: 'Producto eliminado exitosamente.'});
            }else{
                res.json({error: 'No se pudo eliminar el producto.'});
            }
        }catch(error){
            console.log(error);
            next(error);
        }
    }
}

module.exports = ProductoController;