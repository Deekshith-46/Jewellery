const express = require('express');
const router = express.Router();
const contactCtrl = require('../../controllers/user/contactController');

router.post('/', contactCtrl.submitContact);

module.exports = router;


