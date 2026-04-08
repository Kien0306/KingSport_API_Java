const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'order', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending', 'shipping', 'delivered'], default: 'pending' },
  carrier: { type: String, default: 'Nội bộ' },
  trackingCode: { type: String, default: '' },
  note: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('shipment', shipmentSchema);
