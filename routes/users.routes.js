const UserController = require('../controllers/users.controller');
const validaDatosUsuario = require('../middlewares/validaDatosUsuario.middleware');
const authenticateToken = require('../middlewares/auth.middleware');


module.exports = (app) => {
    const userController = new UserController();

    app.get('/api/users', (req, res, next) => userController.getAllUsers(req, res, next));
    app.get('/api/users/:id', (req, res, next) => userController.getUserById(req, res, next));
    app.post('/api/users', authenticateToken, validaDatosUsuario, (req, res, next) => userController.createUser(req, res, next));
    app.post('/api/register', validaDatosUsuario, (req, res, next) => userController.createUser(req, res, next));
    app.put('/api/users/:id', authenticateToken, validaDatosUsuario, (req, res, next) => userController.updateUser(req, res, next));
    app.delete('/api/users/:id', authenticateToken, (req, res, next) => userController.deleteUser(req, res, next));
}