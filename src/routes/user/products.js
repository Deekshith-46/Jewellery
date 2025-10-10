const express = require('express');
const upload = require('../../middleware/upload');
const metalShapeImageCtrl = require('../../controllers/user/metalShapeImageController');
const productController = require('../../controllers/user/productController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

const router = express.Router();

router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/price', productController.getPriceForSelection);

// Public fetch of images for a product's metal+shape
router.get('/:id/metal-shape-images', metalShapeImageCtrl.getByProductMetalShape);

module.exports = router;


