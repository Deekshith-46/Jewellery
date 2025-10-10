const Coupon = require('../../models/admin/Coupon');

exports.createCoupon = async (req, res, next) => {
  try {
    const c = new Coupon(req.body);
    await c.save();
    res.status(201).json(c);
  } catch (err) { next(err); }
};

