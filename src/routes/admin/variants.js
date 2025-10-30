const express = require('express');
const router = express.Router();
const variantController = require('../../controllers/admin/variantController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Admin-only routes for variant management
router.post('/', auth, admin, variantController.createVariant);
router.put('/:id', auth, admin, variantController.updateVariant);
router.delete('/:id', auth, admin, variantController.deleteVariant);

// Admin can also access public routes (for convenience in admin panel)
router.get('/find', auth, admin, variantController.findVariant);
router.get('/product/:productId', auth, admin, variantController.getVariantsByProduct);
router.get('/product/:productId/options', auth, admin, variantController.getAvailableOptions);

module.exports = router;
