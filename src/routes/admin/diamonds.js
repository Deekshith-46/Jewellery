const express = require('express');
const router = express.Router();
const diamondController = require('../../controllers/admin/diamondController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const upload = require('../../middleware/upload');

// GET /api/admin/diamonds -> Get all diamonds with filtering and pagination (public access)
router.get('/', diamondController.getAllDiamonds);

// GET /api/admin/diamonds/filters -> Get filter options for dropdowns (public access)
router.get('/filters', diamondController.getDiamondFilters);

// GET /api/admin/diamonds/:id -> Get specific diamond by ID (public access)
router.get('/:id', diamondController.getDiamondById);

// POST /api/admin/diamonds -> Create single diamond
router.post('/', auth, admin, diamondController.createDiamond);

// PUT /api/admin/diamonds/:id -> Update specific diamond
router.put('/:id', auth, admin, diamondController.updateDiamond);

// DELETE /api/admin/diamonds/:id -> Delete specific diamond
router.delete('/:id', auth, admin, diamondController.deleteDiamond);

// PATCH /api/admin/diamonds/:id/deactivate -> Deactivate specific diamond
router.patch('/:id/deactivate', auth, admin, diamondController.deactivateDiamondByAdmin);

// PATCH /api/admin/diamonds/:id/activate -> Activate specific diamond
router.patch('/:id/activate', auth, admin, diamondController.activateDiamondByAdmin);

// POST /api/admin/diamonds/generate -> Manual multi-create from arrays
router.post('/generate', auth, admin, diamondController.generateDiamonds);

// POST /api/admin/diamonds/bulk -> Excel bulk upload (single file field: file)
router.post('/bulk', auth, admin, upload.excel.single('file'), diamondController.bulkUploadDiamonds);

module.exports = router;


