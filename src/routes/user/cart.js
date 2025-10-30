const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/user/cartController');
const auth = require('../../middleware/auth');

// Get user's cart
router.get('/', auth, cartController.getCart);

// Add Ready-to-Ship item to cart
router.post('/rts', auth, cartController.addRTSToCart);

// Add Design-Your-Own item to cart
router.post('/dyo', auth, cartController.addDYOToCart);

// Update cart item quantity
router.put('/items/:itemId', auth, cartController.updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', auth, cartController.removeFromCart);

// Clear entire cart
router.delete('/', auth, cartController.clearCart);

module.exports = router;
