const mongoose = require('mongoose');

const pointTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  type: { type: String, enum: ['earn', 'redeem'], required: true },
  points: { type: Number, required: true, min: 1 },
  source: { type: String, enum: ['order', 'coupon'], required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'order', default: null },
  coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'coupon', default: null },
  description: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('pointtransaction', pointTransactionSchema);
