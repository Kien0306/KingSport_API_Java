const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
  value: { type: Number, min: 0, required: true },
  minOrderAmount: { type: Number, min: 0, default: 0 },
  maxDiscount: { type: Number, min: 0, default: 0 },
  usedCount: { type: Number, min: 0, default: 0 },
  isPointCoupon: { type: Boolean, default: false },
  pointsCost: { type: Number, min: 0, default: 0 },
  rewardStock: { type: Number, min: 0, default: 0 },
  ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
  isUsedOnce: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('coupon', couponSchema);
