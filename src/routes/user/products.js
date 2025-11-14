const express = require('express');
const upload = require('../../middleware/upload');
const productController = require('../../controllers/user/productController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

const router = express.Router();

// New endpoints for the updated data model
router.get('/filter-options', productController.getFilterOptions); // GET /api/products/filter-options?tab=ready|design
router.get('/counts', productController.getProductCounts); // GET /api/products/counts (lightweight - just counts)
router.get('/list/variants', productController.getProductVariants); // GET /api/products/list/variants?tab=ready|design&productId=... (must come before /list)
router.get('/list', productController.listProducts); // GET /api/products/list?tab=ready|design
router.get('/detail/:productId', productController.getProductDetail); // GET /api/products/detail/:productId

// NEW: Image generation endpoints
router.get('/:id/images', productController.getImagesForSelection); // GET /api/products/:id/images?metal=14Y&shape=RND (DYO)
router.get('/:productId/variants/:variantSku/images', productController.getImagesForVariant); // GET /api/products/:productId/variants/:variantSku/images (RTS)

// Legacy endpoints for backward compatibility
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/price', productController.getPriceForSelection);
router.get('/:id/price/rts', productController.getRtsPriceForSelection);
router.get('/:id/price/dyo', productController.getDyoPriceForSelection);

module.exports = router;


