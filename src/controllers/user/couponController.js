const Coupon = require('../../models/admin/Coupon');
const Order = require('../../models/user/Order');

exports.validateCoupon = async (req, res, next) => {
  try {
    const code = (req.query.code || '').toUpperCase();
    if (!code) return res.status(400).json({ message: 'coupon code required' });
    const coupon = await Coupon.findOne({ code, active: true });
    if (!coupon) return res.status(404).json({ message: 'Coupon not found or inactive' });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return res.status(400).json({ message: 'Coupon expired' });
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return res.status(400).json({ message: 'Coupon usage limit reached' });

    if (coupon.perUserLimit > 0 && req.user) {
      const usedByUser = await Order.countDocuments({ userId: req.user._id, couponCode: coupon.code });
      if (usedByUser >= coupon.perUserLimit) return res.status(400).json({ message: 'Coupon per-user limit reached' });
    }
    res.json({ coupon });
  } catch (err) { next(err); }
};


