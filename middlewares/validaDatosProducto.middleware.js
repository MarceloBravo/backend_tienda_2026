function validaDatosProducto(req, res, next) {
    const {
        asin,
        currency,
        product_price,
        product_title,
    } = req.body;

    // Validación para POST (crear un nuevo producto)
    
    if (!asin || asin.trim().length === 0) {
        return res.status(400).json({ status: 'error', message: 'El campo asin es obligatorio.' });
    }
    if (!currency || currency.trim().length === 0) {
        return res.status(400).json({ status: 'error', message: 'El campo currency es obligatorio.' });
    }
    if (product_price === undefined) {
        return res.status(400).json({ status: 'error', message: 'El campo product_price es obligatorio.' });
    }
    if (!product_title || product_title.trim().length === 0) {
        return res.status(400).json({ status: 'error', message: 'El campo product_title es obligatorio.' });
    }
    
    next();
}
module.exports = validaDatosProducto;