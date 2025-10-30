const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/user/orderController');
const auth = require('../../middleware/auth');

// Checkout from cart and create order
router.post('/checkout', auth, orderController.checkoutFromCart);

// Get all user orders
router.get('/', auth, orderController.getUserOrders);

// Get single order by ID
router.get('/:orderId', auth, orderController.getOrderById);

// Cancel order
router.put('/:orderId/cancel', auth, orderController.cancelOrder);

module.exports = router;
