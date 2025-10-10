const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/admin/orderController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

router.get('/', auth, admin, orderController.adminGetAllOrders);
router.put('/:id/payment', auth, admin, orderController.updatePaymentStatusByAdmin);

module.exports = router;


