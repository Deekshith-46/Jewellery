const express = require('express');
const router = express.Router();
const contactCtrl = require('../../controllers/admin/contactController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

router.get('/', auth, admin, contactCtrl.getAllContactsAdmin);

module.exports = router;


