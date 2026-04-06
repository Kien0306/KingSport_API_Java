const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },
  fullName: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  label: { type: String, default: 'Mặc định' },
  isDefault: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('addresses', addressSchema);
