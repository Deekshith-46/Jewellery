const Coupon = require('../../models/admin/Coupon');

// Normalize code to uppercase helper
function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

// POST /api/admin/coupons
exports.createCoupon = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (!data.code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }
    data.code = normalizeCode(data.code);

    if (!data.discountType || !['fixed', 'percent'].includes(data.discountType)) {
      return res.status(400).json({ success: false, message: 'discountType must be "fixed" or "percent"' });
    }

    if (!data.discountValue || Number(data.discountValue) <= 0) {
      return res.status(400).json({ success: false, message: 'discountValue must be > 0' });
    }

    if (data.discountType === 'percent' && Number(data.discountValue) > 100) {
      return res.status(400).json({ success: false, message: 'Percent discount cannot exceed 100' });
    }

    data.discountValue = Number(data.discountValue);

    const existing = await Coupon.findOne({ code: data.code });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }

    const coupon = await Coupon.create(data);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/coupons
exports.listCoupons = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.code = new RegExp(String(search).trim(), 'i');
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [coupons, total] = await Promise.all([
      Coupon.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Coupon.countDocuments(filter)
    ]);

    res.json({
      success: true,
      coupons,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/coupons/:id
exports.getCouponById = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/coupons/:id
exports.deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/coupons/:id
exports.updateCoupon = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (data.code) {
      data.code = normalizeCode(data.code);
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/coupons/:id/status
exports.toggleCouponStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be "active" or "inactive"' });
    }
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};
