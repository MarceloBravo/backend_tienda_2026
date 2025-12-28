function validaDatosUsuario(req, res, next){
    const {username, nombre, apellido, rol, email, password} = req.body;
    if(
        !username || 
        !nombre || 
        !apellido || 
        !rol || 
        !email || 
        username.trim().length === 0 || 
        nombre.trim().length === 0 || 
        apellido.trim().length === 0 || 
        rol.trim().length === 0 || 
        email.trim().length === 0 || 
        ((!password || password.trim().length === 0) && req.method === 'POST') //Sólo es obligatorio al crear el usuario
    ){
        return res.status(400).json({
            status: 'error',
            message: 'Datos incompletos. Todos los campos son obligatorios.'
        });
    }
    next();
}

module.exports = validaDatosUsuario;