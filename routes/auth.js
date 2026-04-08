var express = require('express');
var router = express.Router();
let userController = require('../controllers/users');
let bcrypt = require('bcrypt');
let jwt = require('jsonwebtoken');
let crypto = require('crypto');
const { CheckLogin } = require('../utils/authHandler');
let cartModel = require('../schemas/carts');
let roleModel = require('../schemas/roles');
const { runDbTransaction } = require('../utils/transactionHelper');
const { ChangePasswordValidator, validatedResult } = require('../utils/validateHandler');
const { sendPasswordResetMail } = require('../utils/mailHandler');

router.post('/register', async function (req, res) {
  try {
    let { username, password, email, fullName } = req.body;
    let customerRole = await roleModel.findOne({ name: 'CUSTOMER', isDeleted: false });
    if (!customerRole) {
      throw new Error('Chua co role CUSTOMER');
    }

    let existedUsername = await userController.GetAnUserByUsername(username);
    if (existedUsername) {
      return res.status(400).send({ message: 'ten dang nhap da ton tai' });
    }

    let existedEmail = await userController.GetAnUserByEmail(email);
    if (existedEmail) {
      return res.status(400).send({ message: 'email da ton tai' });
    }

    await runDbTransaction(async (session) => {
      let newUser = await userController.CreateAnUser(username, password, email, customerRole._id, undefined, fullName, undefined, true, 0, session);
      let cart = new cartModel({ user: newUser._id });
      await cart.save(session ? { session } : undefined);
    });
    res.send({ message: 'dang ky thanh cong' });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post('/login', async function (req, res) {
  try {
    let { username, password } = req.body;
    let user = await userController.GetAnUserByUsername(username);
    if (!user) {
      return res.status(404).send({ message: 'thong tin dang nhap sai' });
    }
    if (user.status === false) {
      return res.status(403).send({ message: 'tai khoan dang bi khoa' });
    }
    if (user.lockTime && user.lockTime > Date.now()) {
      return res.status(403).send({ message: 'ban dang bi khoa tam thoi' });
    }
    if (bcrypt.compareSync(password, user.password)) {
      user.loginCount = 0;
      await user.save();
      let token = jwt.sign({ id: user._id }, 'secret', { expiresIn: '1d' });
      res.cookie('NNPTUD_S4', token, {
        maxAge: 24 * 3600 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
      });
      res.send({ token, user: userController.sanitizeUser(user) });
    } else {
      user.loginCount += 1;
      if (user.loginCount >= 3) {
        user.loginCount = 0;
        user.lockTime = Date.now() + 3600 * 1000;
      }
      await user.save();
      res.status(404).send({ message: 'thong tin dang nhap sai' });
    }
  } catch (error) {
    res.status(404).send({ message: error.message });
  }
});

router.get('/me', CheckLogin, function (req, res) {
  res.send(userController.sanitizeUser(req.user));
});

router.post('/logout', function (req, res) {
  res.cookie('NNPTUD_S4', '', {
    maxAge: 0,
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  });
  res.send({ message: 'logout' });
});

router.post('/changepassword', CheckLogin, ChangePasswordValidator, validatedResult, async function (req, res) {
  let { oldpassword, newpassword } = req.body;
  let user = req.user;
  if (bcrypt.compareSync(oldpassword, user.password)) {
    user.password = newpassword;
    await user.save();
    res.send({ message: 'da cap nhat' });
  } else {
    res.status(400).send({ message: 'old password k dung' });
  }
});

router.post('/forgotpassword', async function (req, res) {
  try {
    let email = String(req.body.email || '').trim().toLowerCase();
    let user = await userController.GetAnUserByEmail(email);
    if (user) {
      user.forgotPasswordToken = crypto.randomBytes(32).toString('hex');
      user.forgotPasswordTokenExp = Date.now() + 10 * 60000;
      await user.save();

      let frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      let url = frontendBaseUrl.replace(/\/$/, '') + '/reset-password/' + user.forgotPasswordToken;
      await sendPasswordResetMail({
        to: user.email,
        customerName: user.fullName || user.username,
        resetUrl: url
      });
    }
    res.send({ message: 'Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đổi mật khẩu.' });
  } catch (error) {
    res.status(400).send({ message: error.message || 'gui email that bai' });
  }
});

router.get('/resetpassword/:token', async function (req, res) {
  try {
    let token = req.params.token;
    let user = await userController.GetAnUserByToken(token);
    if (user) {
      return res.send({ valid: true, message: 'token hop le' });
    }
    res.status(400).send({ valid: false, message: 'token khong hop le hoac da het han' });
  } catch (error) {
    res.status(400).send({ valid: false, message: error.message || 'token khong hop le' });
  }
});

router.post('/resetpassword/:token', async function (req, res) {
  try {
    let token = req.params.token;
    let password = String(req.body.password || '');
    let user = await userController.GetAnUserByToken(token);
    if (!user) {
      return res.status(400).send({ message: 'token khong hop le hoac da het han' });
    }
    if (password.length < 6) {
      return res.status(400).send({ message: 'mat khau moi phai tu 6 ky tu tro len' });
    }
    user.password = password;
    user.forgotPasswordToken = null;
    user.forgotPasswordTokenExp = null;
    await user.save();
    return res.send({ message: 'doi mat khau thanh cong' });
  } catch (error) {
    res.status(400).send({ message: error.message || 'cap nhat that bai' });
  }
});

module.exports = router;
