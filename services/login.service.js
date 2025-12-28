const UsersModel = require('../models/users.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();


class UserService{
    constructor(){
        this.usersModel = new UsersModel();
    }
    

    /**
     * Se encarga de autenticar a traves de email y password
     * @param {string} email Email del usuario usuado para autenticar en lugar del username
     * @param {string} password contraseña del usuario
     * @return {string, string} El acces_token y el refresh token 
     */
    async login(email, password){
        const user = await this.usersModel.login(email);
        if(!user){
            throw new Error('Usuario o contraseña incorrectos. Inténtalo nuevamente.', { cause: 401 });
        }

        const isPasswordValid = await bcrypt.compare(password.toString(), user.password.toString());
        if (!isPasswordValid) {
            throw new Error('Usuario o contraseña incorrectos. Inténtalo nuevamente.', { cause: 401 });
        }

        const {access_token, refresh_token} = this.getTokens(user);
        this.usersModel.updateRefreshToken(user.id, refresh_token);
        return {access_token, refresh_token};
    }
    

    async logout(refreshToken){
        const verify = jwt.verify(refreshToken, process.env.REFRESHTOKEN_SECRETS);

        if(!verify.user.id){
            throw 'El usuario no pudo ser reautentificado.';
        }
        
        const userVerify = verify.user;
        const result = await this.usersModel.logout(userVerify.id);   //Borrando el refresh token de la base de datos
        if(result && result.affectedRows === 0){
            return 'No se pudo cerrar la sesión.';
        }else{
            return 'Sesión cerrada exitosamente.';
        }
    }
    

    /**
     * Se encarga de autenticar a través de token
     * @param {string} refreshToken refresh token utolizado para busqueda en la base ed datos
     * @return {string, string} El acces_token y el refresh token 
     */
    async refreshToken(refreshToken){
        const verify = jwt.verify(refreshToken, process.env.REFRESHTOKEN_SECRETS);

        if(!verify.user.id){
            throw 'El usuario no pudo ser reautentificado.';
        }
        
        const userVerify = verify.user;
        
        const user = await this.usersModel.refreshToken(userVerify.id, refreshToken);
        if(!user){
            throw 'Usuario no encontrado o inexistente. Logueate nuevamente...';
        }
        
        const {access_token, refresh_token} = this.getTokens(user);
        await this.usersModel.updateRefreshToken(userVerify.id, refresh_token);    //Actualiza el refreshtoken en la base de datos
        
        return {access_token, refresh_token};
    }


    /**
     * Se encarga de generar los nuevos acces token y refresh token
     * @param {object} user Objeto con los datos del usuario
     * @return {string, string} El acces_token y el refresh token 
     */
    getTokens(user){
        delete user.password;
        delete user.refresh_token;
        const access_token = jwt.sign({user}, process.env.TOKEN_SECRETS, {expiresIn: process.env.EXPIRES_TIME_TOKEN});    //Agregar datos al token: https://www.npmjs.com/package/jsonwebtoken
        const refresh_token = jwt.sign({user}, process.env.REFRESHTOKEN_SECRETS, {expiresIn: process.env.EXPIRES_TIME_REFRESHTOKEN});    //Token de refresco dura 5:30 hrs, media hora más que el token
        return {access_token, refresh_token};
    }

}

module.exports = UserService;