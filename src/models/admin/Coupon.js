const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, unique: true, index: true },
  type: { type: String, enum: ['fixed', 'percent'] },
  value: Number,
  usageLimit: Number,
  usedCount: { type: Number, default: 0 },
  perUserLimit: Number,
  expiresAt: Date,
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', CouponSchema);


