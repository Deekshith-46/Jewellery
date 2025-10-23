const express = require('express');
const upload = require('../../middleware/upload');
const productController = require('../../controllers/admin/productController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const metalPriceCtrl = require('../../controllers/admin/metalPriceController');
const shapePriceCtrl = require('../../controllers/admin/shapePriceController');

const router = express.Router();

router.post('/', auth, admin, productController.createProductByAdmin);
router.delete('/:id', auth, admin, productController.deleteProductByAdmin);
router.patch('/:id/deactivate', auth, admin, productController.deactivateProductByAdmin);
router.patch('/:id/activate', auth, admin, productController.activateProductByAdmin);

// Bulk upload products via Excel
// Bulk upload with upsert by productSku
router.post('/bulk-sku', auth, admin, upload.excel.single('file'), productController.bulkUploadProductsBySku);

// Update a specific product by id
router.put('/:id', auth, admin, productController.updateProductByAdmin);

// Admin metal price management
router.put('/metals/:id/price', auth, admin, metalPriceCtrl.setPrice);
router.delete('/metals/:id/price', auth, admin, metalPriceCtrl.deletePrice);

// Admin shape price management
router.put('/shapes/:id/price', auth, admin, shapePriceCtrl.setPrice);
router.delete('/shapes/:id/price', auth, admin, shapePriceCtrl.deletePrice);

module.exports = router;

