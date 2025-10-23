const express = require('express');
const router = express.Router();
const diamondController = require('../../controllers/user/diamondController');

// GET /api/diamonds -> Get all diamonds with filtering and pagination (public access)
router.get('/', diamondController.fetchAllDiamonds);

// GET /api/diamonds/filters -> Get filter options for dropdowns (public access)
router.get('/filters', diamondController.getDiamondFilters);

// GET /api/diamonds/debug -> Debug endpoint to check diamond data
router.get('/debug', diamondController.debugDiamonds);

// GET /api/diamonds/:id -> Get specific diamond by ID (public access)
router.get('/:id', diamondController.getDiamondById);

module.exports = router;


