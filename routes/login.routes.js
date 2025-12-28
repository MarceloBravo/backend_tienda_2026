const LoginController = require('../controllers/login.controller');
const validaDatosLogin = require('../middlewares/validaDatosLogin.middleware');

module.exports = (app) => {
    const loginController = new LoginController();

    app.post('/api/login', validaDatosLogin, (req, res, next) => loginController.login(req, res, next));
    app.post('/api/logout', (req, res, next) => loginController.logout(req, res, next));
    app.post('/api/refreshToken', (req, res, next) => loginController.refreshToken(req, res, next));
}