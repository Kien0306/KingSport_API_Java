var express = require('express');
var router = express.Router();
const couponModel = require('../schemas/coupons');
const mongoose = require('mongoose');
const { CheckLogin, CheckRole } = require('../utils/authHandler');
const { broadcast } = require('../utils/realtime');

function calcDiscount(coupon, amount) {
  const total = Number(amount || 0);
  if (!coupon || total <= 0) return 0;
  let discount = coupon.type === 'fixed' ? Number(coupon.value || 0) : Math.round(total * Number(coupon.value || 0) / 100);
  if (coupon.type === 'percent' && coupon.maxDiscount && coupon.maxDiscount > 0) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = Math.min(discount, total);
  return Math.max(discount, 0);
}

function buildRewardTemplateTitle(type, value, pointsCost) {
  const rewardText = type === 'percent' ? `Giảm ${Number(value || 0)}%` : `Giảm ${Number(value || 0).toLocaleString('vi-VN')}đ`;
  return `${rewardText} đổi bằng ${Number(pointsCost || 0).toLocaleString('vi-VN')} điểm`;
}

function buildRewardTemplateCode(id, type, pointsCost) {
  const suffix = String(id || '').slice(-6).toUpperCase() || Date.now().toString().slice(-6);
  const prefix = type === 'percent' ? 'RWP' : 'RWF';
  return `${prefix}${Number(pointsCost || 0)}${suffix}`;
}

router.post('/validate', CheckLogin, async function (req, res) {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const amount = Number(req.body.amount || 0);
    if (!code) return res.status(400).send({ message: 'vui long nhap ma giam gia' });
    const coupon = await couponModel.findOne({ code, isActive: true, isDeleted: false });
    if (!coupon) return res.status(404).send({ message: 'ma giam gia khong hop le' });
    if (coupon.isPointCoupon && !coupon.ownerUser) {
      return res.status(400).send({ message: 'ma nay chi dung de doi diem, khong ap dung truc tiep khi thanh toan' });
    }
    if (coupon.ownerUser && String(coupon.ownerUser) !== String(req.user.id)) {
      return res.status(403).send({ message: 'ma giam gia nay khong thuoc tai khoan cua ban' });
    }
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
      return res.status(400).send({ message: 'ma giam gia da het han' });
    }
    if (coupon.isPointCoupon && coupon.isUsedOnce) {
      return res.status(400).send({ message: 'ma doi diem nay da duoc su dung' });
    }
    if (amount < Number(coupon.minOrderAmount || 0)) {
      return res.status(400).send({ message: `don toi thieu ${Number(coupon.minOrderAmount || 0).toLocaleString('vi-VN')}đ moi dung duoc ma nay` });
    }
    const discountAmount = calcDiscount(coupon, amount);
    return res.send({
      couponId: coupon._id,
      code: coupon.code,
      title: coupon.title,
      type: coupon.type,
      value: coupon.value,
      discountAmount,
      finalAmount: Math.max(0, amount - discountAmount)
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.get('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const item = await couponModel.findOne({ _id: req.params.id, isDeleted: false, ownerUser: null });
    if (!item) return res.status(404).send({ message: 'khong tim thay ma giam gia' });
    res.send(item);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.get('/', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const group = String(req.query.group || '').trim();
    const filter = { isDeleted: false, ownerUser: null };
    if (group === 'reward') filter.isPointCoupon = true;
    if (group === 'payment') filter.isPointCoupon = false;
    const items = await couponModel.find(filter).sort({ isPointCoupon: -1, createdAt: -1 });
    res.send(items);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post('/', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const title = String(req.body.title || '').trim();
    const type = req.body.type === 'fixed' ? 'fixed' : 'percent';
    const value = Number(req.body.value || 0);
    const minOrderAmount = Number(req.body.minOrderAmount || 0);
    const maxDiscount = Number(req.body.maxDiscount || 0);
    const isActive = req.body.isActive !== false;
    const isPointCoupon = req.body.isPointCoupon === true || req.body.isPointCoupon === 'true';
    const pointsCost = Number(req.body.pointsCost || 0);
    const rewardStock = Number(req.body.rewardStock || 0);
    if (!isPointCoupon && (!code || !title)) return res.status(400).send({ message: 'vui long nhap day du ma va ten ma giam gia' });
    if (value <= 0) return res.status(400).send({ message: 'gia tri giam gia phai lon hon 0' });
    if (isPointCoupon && pointsCost <= 0) return res.status(400).send({ message: 'vui long nhap so diem doi hop le' });
    if (type === 'percent' && value > 100) return res.status(400).send({ message: 'giam theo phan tram chi duoc tu 1 den 100' });
    let finalCode = code;
    let finalTitle = title;
    if (isPointCoupon) {
      const generatedId = new mongoose.Types.ObjectId();
      finalCode = buildRewardTemplateCode(generatedId, type, pointsCost);
      finalTitle = buildRewardTemplateTitle(type, value, pointsCost);
      const item = await couponModel.create({ _id: generatedId, code: finalCode, title: finalTitle, type, value, minOrderAmount: 0, maxDiscount, isActive, isPointCoupon, pointsCost, rewardStock, ownerUser: null, isUsedOnce: false });
      broadcast('coupon.updated', { couponId: String(item._id) });
      return res.send(item);
    }
    const existed = await couponModel.findOne({ code: finalCode, isDeleted: false, ownerUser: null });
    if (existed) return res.status(400).send({ message: 'ma giam gia da ton tai' });
    const item = await couponModel.create({ code: finalCode, title: finalTitle, type, value, minOrderAmount, maxDiscount, isActive, isPointCoupon, pointsCost, rewardStock, ownerUser: null, isUsedOnce: false });
    broadcast('coupon.updated', { couponId: String(item._id) });
    res.send(item);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.put('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    const title = String(req.body.title || '').trim();
    const type = req.body.type === 'fixed' ? 'fixed' : 'percent';
    const value = Number(req.body.value || 0);
    const minOrderAmount = Number(req.body.minOrderAmount || 0);
    const maxDiscount = Number(req.body.maxDiscount || 0);
    const isActive = req.body.isActive !== false;
    const isPointCoupon = req.body.isPointCoupon === true || req.body.isPointCoupon === 'true';
    const pointsCost = Number(req.body.pointsCost || 0);
    const rewardStock = Number(req.body.rewardStock || 0);
    if (!isPointCoupon && (!code || !title)) return res.status(400).send({ message: 'vui long nhap day du ma va ten ma giam gia' });
    if (value <= 0) return res.status(400).send({ message: 'gia tri giam gia phai lon hon 0' });
    if (isPointCoupon && pointsCost <= 0) return res.status(400).send({ message: 'vui long nhap so diem doi hop le' });
    if (type === 'percent' && value > 100) return res.status(400).send({ message: 'giam theo phan tram chi duoc tu 1 den 100' });
    let finalCode = code;
    let finalTitle = title;
    if (isPointCoupon) {
      finalCode = buildRewardTemplateCode(req.params.id, type, pointsCost);
      finalTitle = buildRewardTemplateTitle(type, value, pointsCost);
    } else {
      const existed = await couponModel.findOne({ _id: { $ne: req.params.id }, code: finalCode, isDeleted: false, ownerUser: null });
      if (existed) return res.status(400).send({ message: 'ma giam gia da ton tai' });
    }
    const item = await couponModel.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, ownerUser: null },
      { code: finalCode, title: finalTitle, type, value, minOrderAmount: isPointCoupon ? 0 : minOrderAmount, maxDiscount, isActive, isPointCoupon, pointsCost, rewardStock },
      { new: true }
    );
    if (!item) return res.status(404).send({ message: 'khong tim thay ma giam gia' });
    broadcast('coupon.updated', { couponId: String(item._id) });
    res.send(item);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.delete('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const item = await couponModel.findOneAndUpdate({ _id: req.params.id, ownerUser: null }, { isDeleted: true }, { new: true });
    if (!item) return res.status(404).send({ message: 'khong tim thay ma giam gia' });
    broadcast('coupon.updated', { couponId: String(req.params.id) });
    res.send({ message: 'da xoa ma giam gia' });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
