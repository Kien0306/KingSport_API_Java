let userController = require('../controllers/users');
let jwt = require('jsonwebtoken');
module.exports = {
  CheckLogin: async function (req, res, next) {
    try {
      let token;
      if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
        if (req.cookies.NNPTUD_S4) {
          token = req.cookies.NNPTUD_S4;
        } else {
          return res.status(401).send({ message: 'ban chua dang nhap' });
        }
      } else {
        token = req.headers.authorization.split(' ')[1];
      }
      let result = jwt.verify(token, 'secret');
      if (result.exp * 1000 < Date.now()) {
        return res.status(401).send({ message: 'ban chua dang nhap' });
      }
      let user = await userController.GetAnUserById(result.id);
      if (!user) {
        return res.status(401).send({ message: 'ban chua dang nhap' });
      }
      req.user = user;
      next();
    } catch (error) {
      res.status(401).send({ message: 'ban chua dang nhap' });
    }
  },
  CheckRole: function (...requiredRole) {
    return async function (req, res, next) {
      let user = req.user;
      let currentRole = user.role.name;
      if (requiredRole.includes(currentRole)) {
        next();
      } else {
        res.status(403).send({ message: 'ban khong co quyen' });
      }
    };
  }
};
