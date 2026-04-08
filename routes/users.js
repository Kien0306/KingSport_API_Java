var express = require('express');
var router = express.Router();
let userModel = require('../schemas/users');
let roleModel = require('../schemas/roles');
let cartModel = require('../schemas/carts');
let { CreateAnUserValidator, validatedResult, ModifyAnUser } = require('../utils/validateHandler');
let userController = require('../controllers/users');
let { CheckLogin, CheckRole } = require('../utils/authHandler');
const { broadcast } = require('../utils/realtime');

router.get('/', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  let users = await userController.GetAllUser();
  res.send(users.map(userController.sanitizeUser));
});

router.get('/:id', CheckLogin, CheckRole('ADMIN', 'MODERATOR'), async function (req, res) {
  try {
    let result = await userModel.findOne({ _id: req.params.id, isDeleted: false }).populate('role', 'name description');
    if (result) {
      res.send(userController.sanitizeUser(result));
    } else {
      res.status(404).send({ message: 'id not found' });
    }
  } catch (error) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.post('/', CheckLogin, CheckRole('ADMIN'), CreateAnUserValidator, validatedResult, async function (req, res) {
  try {
    let role = await roleModel.findById(req.body.role);
    if (!role || role.isDeleted) {
      return res.status(400).send({ message: 'role khong hop le' });
    }
    let newItem = await userController.CreateAnUser(
      req.body.username,
      req.body.password,
      req.body.email,
      req.body.role,
      undefined,
      req.body.fullName,
      req.body.avatarUrl,
      req.body.status,
      req.body.loginCount
    );
    await new cartModel({ user: newItem._id }).save();
    let saved = await userModel.findById(newItem._id).populate('role', 'name description');
    const payload = userController.sanitizeUser(saved);
    broadcast('user.updated', { userId: String(payload._id || payload.id || '') });
    res.send(payload);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', CheckLogin, CheckRole('ADMIN'), ModifyAnUser, validatedResult, async function (req, res) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true }).populate('role', 'name description');
    if (!updatedItem) return res.status(404).send({ message: 'id not found' });
    const payload = userController.sanitizeUser(updatedItem);
    broadcast('user.updated', { userId: String(payload._id || payload.id || '') });
    res.send(payload);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/:id/toggle-lock', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    let user = await userModel.findById(req.params.id).populate('role', 'name description');
    if (!user || user.isDeleted) return res.status(404).send({ message: 'id not found' });
    if (user.username === 'admin') return res.status(400).send({ message: 'khong the khoa tai khoan admin he thong' });

    const nextStatus = !(user.status === true);
    user.status = nextStatus;
    user.loginCount = 0;
    user.lockTime = nextStatus ? null : new Date(Date.now() + 365 * 24 * 3600 * 1000);
    await user.save();
    let saved = await userModel.findById(req.params.id).populate('role', 'name description');
    const payload = userController.sanitizeUser(saved);
    broadcast('user.updated', { userId: String(payload._id || payload.id || '') });
    res.send(payload);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true }).populate('role', 'name description');
    if (!updatedItem) {
      return res.status(404).send({ message: 'id not found' });
    }
    const payload = userController.sanitizeUser(updatedItem);
    broadcast('user.updated', { userId: String(payload._id || payload.id || '') });
    res.send(payload);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
