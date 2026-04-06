var express = require('express');
var router = express.Router();
const userModel = require('../schemas/users');
const couponModel = require('../schemas/coupons');
const pointTransactionModel = require('../schemas/pointtransactions');
const { CheckLogin } = require('../utils/authHandler');
const { runDbTransaction } = require('../utils/transactionHelper');
const { broadcast } = require('../utils/realtime');

router.get('/me', CheckLogin, async function (req, res) {
  try {
    const user = await userModel.findById(req.user.id).select('fullName username loyaltyPoints');
    const rewardOptions = await couponModel.find({
      ownerUser: null,
      isDeleted: false,
      isPointCoupon: true,
      isActive: true,
      rewardStock: { $gt: 0 }
    }).sort({ pointsCost: 1, createdAt: 1 }).select('code title value type pointsCost rewardStock maxDiscount');

    const coupons = await couponModel.find({
      ownerUser: req.user.id,
      isDeleted: false,
      isPointCoupon: true,
      isUsedOnce: false,
      isActive: true
    }).sort({ createdAt: -1 }).limit(10).select('code title value type isActive isUsedOnce pointsCost expiresAt createdAt');

    const history = await pointTransactionModel.find({ user: req.user.id, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type points source description createdAt');

    res.send({
      points: Number(user?.loyaltyPoints || 0),
      rewardOptions,
      coupons,
      history
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post('/redeem', CheckLogin, async function (req, res) {
  try {
    const rewardId = String(req.body.rewardId || '').trim();
    const pointsCost = Number(req.body.pointsCost || 0);

    const result = await runDbTransaction(async (session) => {
      let userQuery = userModel.findById(req.user.id);
      if (session) userQuery = userQuery.session(session);
      const user = await userQuery;
      if (!user) throw new Error('khong tim thay nguoi dung');

      let rewardQuery = couponModel.findOne({
        ownerUser: null,
        isDeleted: false,
        isPointCoupon: true,
        isActive: true,
        rewardStock: { $gt: 0 },
        ...(rewardId ? { _id: rewardId } : { pointsCost })
      });
      if (session) rewardQuery = rewardQuery.session(session);
      const reward = await rewardQuery;
      if (!reward) throw new Error('moc doi diem khong hop le');

      if (Number(user.loyaltyPoints || 0) < Number(reward.pointsCost || 0)) {
        throw new Error('ban khong du diem de doi ma');
      }

      const code = `DIEM${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const couponDocs = await couponModel.create([{
        code,
        title: reward.title,
        type: reward.type || 'fixed',
        value: Number(reward.value || 0),
        minOrderAmount: Number(reward.minOrderAmount || 0),
        maxDiscount: Number(reward.maxDiscount || reward.value || 0),
        usedCount: 0,
        isPointCoupon: true,
        pointsCost: Number(reward.pointsCost || 0),
        rewardStock: 0,
        ownerUser: user._id,
        isUsedOnce: false,
        expiresAt,
        isActive: true,
        isDeleted: false
      }], session ? { session } : undefined);
      const coupon = couponDocs[0];

      user.loyaltyPoints = Math.max(0, Number(user.loyaltyPoints || 0) - Number(reward.pointsCost || 0));
      await user.save(session ? { session } : undefined);

      reward.rewardStock = Math.max(0, Number(reward.rewardStock || 0) - 1);
      await reward.save(session ? { session } : undefined);

      await pointTransactionModel.create([{
        user: user._id,
        type: 'redeem',
        points: Number(reward.pointsCost || 0),
        source: 'coupon',
        coupon: coupon._id,
        description: `Đổi ${Number(reward.pointsCost || 0)} điểm lấy mã ${code}`
      }], session ? { session } : undefined);

      return { coupon, points: user.loyaltyPoints, reward };
    });

    broadcast('loyalty.updated', { userId: String(req.user.id) });
    broadcast('coupon.updated', { couponId: String(result.coupon._id) });
    broadcast('coupon.updated', { couponId: String(result.reward._id) });
    res.send({
      message: 'doi diem thanh cong',
      points: result.points,
      coupon: result.coupon
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
