const express = require('express');
const upload = require('../../middleware/upload');
const productController = require('../../controllers/user/productController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

const router = express.Router();

// New endpoints for the updated data model
router.get('/list', productController.listProducts); // GET /api/products/list?tab=ready|design
router.get('/detail/:productId', productController.getProductDetail); // GET /api/products/detail/:productId

// Legacy endpoints for backward compatibility
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/price', productController.getPriceForSelection);

module.exports = router;


