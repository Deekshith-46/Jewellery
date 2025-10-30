const express = require('express');
const router = express.Router();
const metalsController = require('../../controllers/admin/metalsController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Public routes
router.get('/', metalsController.listMetals);
router.get('/:metal_type', metalsController.getMetal);
router.post('/calculate-price', metalsController.calculateCustomPrice);

// Admin routes
router.post('/', auth, admin, metalsController.createMetal);
router.put('/bulk-update', auth, admin, metalsController.bulkUpdateMetals); // Bulk update (must be before /:metal_type)
router.put('/:metal_type', auth, admin, metalsController.updateMetal);
router.delete('/:metal_type', auth, admin, metalsController.deleteMetal);

module.exports = router;
