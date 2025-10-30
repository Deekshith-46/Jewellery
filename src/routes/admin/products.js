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

// DEBUG: Get all variants for a product
router.get('/:productSku/variants/debug', auth, admin, async (req, res) => {
  try {
    const Variant = require('../../models/admin/Variant');
    const { productSku } = req.params;
    const variants = await Variant.find({ productSku }).sort({ createdAt: 1 });
    res.json({
      productSku,
      count: variants.length,
      variants: variants.map(v => ({
        variant_sku: v.variant_sku,
        productSku: v.productSku,
        metal_type: v.metal_type,
        shape: v.shape,
        carat: v.carat,
        product: v.product
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

