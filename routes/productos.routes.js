const ProductoController = require('../controllers/productos.controller.js');
const validaDatosProducto = require('../middlewares/validaDatosProducto.middleware.js');
const upload = require('../middlewares/upload.js');

const parseData = require('../middlewares/parseData.middleware.js');

module.exports = (app) => {
    const productoController = new ProductoController();

    app.get('/api/productos', (req, res, next) => productoController.getAllProducts(req, res, next));
    app.get('/api/productos/:id', (req, res, next) => productoController.getProductByAsin(req, res, next));
    app.post('/api/productos', upload.single('product_photo'), parseData, validaDatosProducto, (req, res, next) => productoController.createProduct(req, res, next));
    app.put('/api/productos/:id', upload.single('product_photo'), parseData, validaDatosProducto, (req, res, next) => productoController.updateProduct(req, res, next));
    app.delete('/api/productos/:id', (req, res, next) => productoController.deleteProduct(req, res, next));
}