const express = require('express');
const router = express.Router();
const contactController = require('../../controllers/user/contactController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Public contact form submission
router.post('/', contactController.createContact);

// Admin: list contacts
router.get('/admin', auth, admin, contactController.listContactsForAdmin);

module.exports = router;
