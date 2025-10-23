const express = require('express');
const upload = require('../../middleware/upload');
const productController = require('../../controllers/user/productController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

const router = express.Router();

router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/price', productController.getPriceForSelection);

module.exports = router;


