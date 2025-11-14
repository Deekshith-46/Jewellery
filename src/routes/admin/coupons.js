const express = require('express');
const router = express.Router();
const couponController = require('../../controllers/admin/couponController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Create coupon
router.post('/', auth, admin, couponController.createCoupon);

// List coupons
router.get('/', auth, admin, couponController.listCoupons);

// Get single coupon
router.get('/:id', auth, admin, couponController.getCouponById);

// Update coupon
router.put('/:id', auth, admin, couponController.updateCoupon);

// Toggle status
router.patch('/:id/status', auth, admin, couponController.toggleCouponStatus);

// Delete coupon
router.delete('/:id', auth, admin, couponController.deleteCoupon);

module.exports = router;
