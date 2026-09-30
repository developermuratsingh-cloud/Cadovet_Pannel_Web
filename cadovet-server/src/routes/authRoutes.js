const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passwordResetController = require('../controllers/passwordResetController');
const otpController = require('../controllers/otpController');
const locationController = require('../controllers/locationController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.post('/login', authController.login);   // staff: email + password (customers use /otp/*)
router.post('/change-password', authenticateUser, authController.changePassword);
// Switch which of your own assigned branches you're currently working out of (multi-location staff only).
router.patch('/active-location', authenticateUser, locationController.setActiveLocation);
// Passwordless customer auth (mobile app): a 6-digit code sent by SMS replaces the password.
router.post('/otp/send', otpController.sendOtp);
router.post('/otp/login', otpController.loginWithOtp);
router.post('/otp/signup', otpController.signupWithOtp);
router.post('/me/otp', authenticateUser, otpController.sendDeleteOtp);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', passwordResetController.forgotPassword);
router.post('/reset-password', passwordResetController.resetPassword);
router.get('/me', authenticateUser, authController.me);
router.patch('/me', authenticateUser, authController.updateMe);
// Self-service account deletion (customers): requires the current password, or a code sent by POST /me/otp.
router.delete('/me', authenticateUser, authController.deleteMe);
// Access tokens are stateless; logout revokes the refresh token when one is supplied.
router.post('/logout', authController.logout);

module.exports = router;
