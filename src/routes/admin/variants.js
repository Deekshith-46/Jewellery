const express = require('express');
const router = express.Router();
const variantController = require('../../controllers/admin/variantController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Public routes for finding variants
router.get('/find', variantController.findVariant);
router.get('/product/:productId', variantController.getVariantsByProduct);
router.get('/product/:productId/options', variantController.getAvailableOptions);

// Admin routes for variant management
router.post('/', auth, admin, variantController.createVariant);
router.put('/:id', auth, admin, variantController.updateVariant);
router.delete('/:id', auth, admin, variantController.deleteVariant);

module.exports = router;
