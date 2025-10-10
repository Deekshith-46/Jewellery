const express = require('express');
const router = express.Router();
const wl = require('../../controllers/user/wishlistController');
const auth = require('../../middleware/auth');

router.post('/', auth, wl.addWish);
router.get('/', auth, wl.getAllByUser);
router.delete('/:id', auth, wl.deleteWish);

module.exports = router;


