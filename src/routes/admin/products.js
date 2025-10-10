const express = require('express');
const upload = require('../../middleware/upload');
const metalShapeImageCtrl = require('../../controllers/admin/metalShapeImageController');
const productController = require('../../controllers/admin/productController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const metalPriceCtrl = require('../../controllers/admin/metalPriceController');
const shapePriceCtrl = require('../../controllers/admin/shapePriceController');

const router = express.Router();

router.post('/', auth, admin, productController.createProductByAdmin);
router.delete('/:id', auth, admin, productController.deleteProductByAdmin);

router.post('/:id/metal-shape-images',
  auth, admin,
  upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'top', maxCount: 1 },
    { name: 'hand', maxCount: 1 },
    { name: 'diagram', maxCount: 1 }
  ]),
  metalShapeImageCtrl.uploadMetalShapeImages
);

router.delete('/:id/metal-shape-images', auth, admin, metalShapeImageCtrl.deleteByProductMetalShape);

// Bulk upload products via Excel
router.post('/bulk', auth, admin, upload.excel.single('file'), productController.bulkUploadProducts);

// Update a specific product by id
router.put('/:id', auth, admin, productController.updateProductByAdmin);

// Admin metal price management
router.put('/metals/:id/price', auth, admin, metalPriceCtrl.setPrice);
router.delete('/metals/:id/price', auth, admin, metalPriceCtrl.deletePrice);

// Admin shape price management
router.put('/shapes/:id/price', auth, admin, shapePriceCtrl.setPrice);
router.delete('/shapes/:id/price', auth, admin, shapePriceCtrl.deletePrice);

module.exports = router;

