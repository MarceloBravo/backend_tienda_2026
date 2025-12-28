const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: 'Acceso denegado. Token requerido.'
        });
    }

    jwt.verify(token, process.env.TOKEN_SECRETS, (err, decoded) => {
        if (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ error: "Token expirado" });
            }
            return res.status(401).json({ error: "Token inválido" });
        }

        req.user = decoded.user; // Agregar el usuario decodificado a req
        next();
    });
}

module.exports = authenticateToken;