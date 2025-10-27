const express = require('express');
const upload = require('../../middleware/upload');
const productController = require('../../controllers/admin/productController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

const router = express.Router();

router.post('/', auth, admin, productController.createProductByAdmin);
router.delete('/:id', auth, admin, productController.deleteProductByAdmin);
router.patch('/:id/deactivate', auth, admin, productController.deactivateProductByAdmin);
router.patch('/:id/activate', auth, admin, productController.activateProductByAdmin);

// Bulk upload products via Excel
router.post('/bulk-sku', auth, admin, upload.excel.single('file'), productController.bulkUploadProductsBySku);

// Update a specific product by id
router.put('/:id', auth, admin, productController.updateProductByAdmin);

module.exports = router;

