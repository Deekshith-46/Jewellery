const express = require('express');
const router = express.Router();
const addressCtrl = require('../../controllers/user/addressController');
const auth = require('../../middleware/auth');

router.post('/', auth, addressCtrl.addAddress);
router.get('/', auth, addressCtrl.listAddresses);
router.put('/:id', auth, addressCtrl.updateAddress);
router.delete('/:id', auth, addressCtrl.deleteAddress);

module.exports = router;


