const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../../controllers/user/authController');

router.post('/register_user', [
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], authController.registerUser);

router.post('/login_user', authController.loginUser);

// Forgot password (request reset token)
router.post('/forgot_password', authController.forgotPassword);

// Reset password using token
router.post('/reset_password', authController.resetPassword);

module.exports = router;


