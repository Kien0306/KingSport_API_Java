const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
  title: { type: String, required: true },
  quantity: { type: Number, min: 1, required: true },
  price: { type: Number, min: 0, required: true },
  subtotal: { type: Number, min: 0, required: true },
  size: { type: String, default: '' },
  colorName: { type: String, default: '' },
  colorHex: { type: String, default: '' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  orderNumber: { type: Number, unique: true, sparse: true },
  products: { type: [orderItemSchema], default: [] },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, default: '', trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  paymentMethod: { type: String, enum: ['cod', 'bank'], default: 'cod' },
  paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  deliveryStatus: { type: String, enum: ['pending', 'shipping', 'delivered'], default: 'pending' },
  originalAmount: { type: Number, min: 0, default: 0 },
  discountAmount: { type: Number, min: 0, default: 0 },
  couponCode: { type: String, default: '' },
  amount: { type: Number, min: 0, required: true },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'payment' },
  shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'shipment' },
  note: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('order', orderSchema);
