const express = require('express');
const router = express.Router();
const diamondController = require('../../controllers/user/diamondController');

router.get('/', diamondController.fetchAllDiamonds);
router.get('/:id', diamondController.getDiamondById);

module.exports = router;


