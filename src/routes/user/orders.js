const express = require('express');
const router = express.Router();
const orderCtrl = require('../../controllers/user/orderController');
const auth = require('../../middleware/auth');

router.post('/', auth, orderCtrl.placeOrder);
router.get('/user', auth, orderCtrl.getUserOrders);

module.exports = router;


