function validaDatosLogin(req, res, next) {
    const { email, password } = req.body;

    if (
        !email || 
        !password || 
        email.trim().length === 0 || 
        password.trim().length === 0 
    ) {
        return res.status(400).json({
            status: 'error',
            message: 'Email y el password son requeridos y no pueden estar vacíos.'
        });
    }

    next();
}

module.exports = validaDatosLogin;