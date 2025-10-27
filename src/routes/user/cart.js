const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/user/cartController');
const auth = require('../../middleware/auth');

// All cart routes require authentication
router.get('/:userId', auth, cartController.getCart);
router.post('/:userId/add', auth, cartController.addToCart);
router.put('/:userId/item/:index', auth, cartController.updateItem);
router.delete('/:userId/item/:index', auth, cartController.removeItem);
router.delete('/:userId/clear', auth, cartController.clearCart);
router.post('/:userId/checkout', auth, cartController.checkout);

module.exports = router;
