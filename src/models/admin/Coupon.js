const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, index: true },
  description: { type: String },

  discountType: { type: String, enum: ['fixed', 'percent'], required: true },
  discountValue: { type: Number, required: true },

  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },

  startDate: { type: Date },
  endDate: { type: Date },
  minOrderAmount: { type: Number },
  maxDiscountAmount: { type: Number },

  maxGlobalUses: { type: Number },
  maxUsesPerUser: { type: Number },
  usedCount: { type: Number, default: 0 },
  usedByUsers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 0 }
  }]
}, { timestamps: true });

CouponSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('Coupon', CouponSchema);
