const express = require('express');
const upload = require('../../middleware/upload');
const bulkUploadController = require('../../controllers/admin/bulkUploadController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

const router = express.Router();

// Fast bulk upload - processes all 4 sheets (Products, ExpandedVariants, DYOExpandedVariants, Metals)
// POST /api/admin/products/bulk-upload
router.post('/bulk-upload', auth, admin, upload.excel.single('file'), bulkUploadController.bulkUploadProducts);

module.exports = router;

