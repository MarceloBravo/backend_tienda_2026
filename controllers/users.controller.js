const UserModel = require('../models/users.model');

class UserController{
    constructor(){
        this.userModel = new UserModel();
    }

    async getAllUsers(req, res, next){
        try {
            const search = req.query.search; // Extraer el parámetro de búsqueda
            const users = await this.userModel.getUsersAll(search);
            res.json({data: users});
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async getUserById(req, res, next){
        try {
            const id = req.params.id;
            const user = await this.userModel.getUserById(id);
            res.json({data: user});
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async createUser(req, res, next){
        try {
            const data = req.body;
            const result = await this.userModel.createUser(data);
            if(result && result.affectedRows === 1){
                const user = await this.userModel.getUserById(result.insertId);
                return res.json({mensaje: 'Usuario creado exitosamente.',data: user});
            }else{
                res.json({error: 'No se pudo crear el usuario.'});
            }
        }catch(error){
            console.log(error);
            next(error);
        }
    }


    async updateUser(req, res, next){
        try {
            const id = req.params.id;
            const data = req.body;
            const result = await this.userModel.updateUser(id, data);
            if(result && result.affectedRows === 1){
                const user = await this.userModel.getUserById(id);
                return res.json({mensaje: 'Usuario actualizado exitosamente.',data: user});
            }else{
                res.json({error: 'No se pudo actualizar el usuario.'});
            }
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async deleteUser(req, res, next){
        try {
            const id = req.params.id;
            const result = await this.userModel.deleteUser(id);
            if(result && result.affectedRows === 1){
                return res.json({mensaje: 'Usuario eliminado exitosamente.'});
            }else{
                res.json({error: 'No se pudo eliminar el usuario.'});
            }
        }catch(error){
            console.log(error);
            next(error);
        }
    }
}

module.exports = UserController;