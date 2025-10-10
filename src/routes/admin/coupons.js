const express = require('express');
const router = express.Router();
const couponController = require('../../controllers/admin/couponController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

router.post('/', auth, admin, couponController.createCoupon);

module.exports = router;


