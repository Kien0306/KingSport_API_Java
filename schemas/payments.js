const mongoose = require('mongoose');

const paymentItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
  title: { type: String, required: true },
  quantity: { type: Number, min: 1, required: true },
  price: { type: Number, min: 0, required: true },
  subtotal: { type: Number, min: 0, required: true }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'order' },
  products: { type: [paymentItemSchema], default: [] },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  paymentMethod: { type: String, enum: ['cod', 'bank'], default: 'cod' },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  deliveryStatus: { type: String, enum: ['pending', 'shipping', 'delivered'], default: 'pending' },
  originalAmount: { type: Number, min: 0, default: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  couponCode: { type: String, default: '' },
  amount: { type: Number, min: 0, required: true },
  transferInfo: {
    bankName: { type: String, default: 'MB Bank' },
    accountNumber: { type: String, default: '1900202608888' },
    accountName: { type: String, default: 'PHAN MINH SANG' }
  },
  note: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('payment', paymentSchema);
