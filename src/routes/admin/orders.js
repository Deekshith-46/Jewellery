const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/admin/orderController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Get order statistics
router.get('/stats', auth, admin, orderController.getOrderStats);

// Get all orders
router.get('/', auth, admin, orderController.adminGetAllOrders);

// Get single order by ID
router.get('/:id', auth, admin, orderController.adminGetOrderById);

// Update order status and payment
router.put('/:id', auth, admin, orderController.updateOrderStatus);

module.exports = router;
