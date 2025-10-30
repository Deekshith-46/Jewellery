const express = require('express');
const router = express.Router();
const variantController = require('../../controllers/admin/variantController');

// Public routes for finding variants (no auth required)
router.get('/find', variantController.findVariant);
router.get('/product/:productId', variantController.getVariantsByProduct);
router.get('/product/:productId/options', variantController.getAvailableOptions);

module.exports = router;

