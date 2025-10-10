const express = require('express');
const router = express.Router();
const diamondController = require('../../controllers/admin/diamondController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const upload = require('../../middleware/upload');

router.post('/', auth, admin, diamondController.createDiamond);
router.put('/:id', auth, admin, diamondController.updateDiamond);
router.delete('/:id', auth, admin, diamondController.deleteDiamond);

module.exports = router;

// POST /api/admin/diamonds/generate -> manual multi-create from arrays
router.post('/generate', auth, admin, diamondController.generateDiamonds);

// POST /api/admin/diamonds/bulk -> Excel bulk upload (single file field: file)
router.post('/bulk', auth, admin, upload.excel.single('file'), diamondController.bulkUploadDiamonds);


