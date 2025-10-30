const express = require('express');
const router = express.Router();
const wl = require('../../controllers/user/wishlistController');
const auth = require('../../middleware/auth');

// Add item to wishlist (product or diamond)
router.post('/', auth, wl.addToWishlist);

// Get all wishlist items (with optional type filter)
router.get('/', auth, wl.getWishlist);

// Check if item is in wishlist
router.post('/check', auth, wl.checkInWishlist);

// Clear wishlist (all or by type)
router.delete('/clear', auth, wl.clearWishlist);

// Remove specific item from wishlist
router.delete('/:id', auth, wl.removeFromWishlist);

module.exports = router;


