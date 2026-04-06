const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  imageUrl: { type: String, required: true },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('banners', bannerSchema);
