const LoginService = require('../services/login.service');


class LoginController{
    constructor(){
        this.loginService = new LoginService();
    }

    async login(req, res, next){
        try {
            const {email, password} = req.body;
            const data = await this.loginService.login(email, password);
            res.json({data});
            
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    async logout(req, res, next){
        try{
        const {refreshToken} = req.body;
        const result = await this.loginService.logout(refreshToken);
        res.json({data: result});
        }catch(error){
            console.log(error);
            next(error);
        }
    }

    



    async refreshToken(req, res, next){
        try {
            const {refreshToken} = req.body;
            const result = await this.loginService.refreshToken(refreshToken);
            res.json({data: result});
        }catch(error){
            console.log(error);
            next(error);
        }
    }
}

module.exports = LoginController;