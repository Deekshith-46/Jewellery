const express = require('express');
const router = express.Router();
const couponController = require('../../controllers/user/couponController');
const auth = require('../../middleware/auth');

router.get('/validate', auth, couponController.validateCoupon);

module.exports = router;


