const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.get('/me', authenticateUser, referralController.getMyReferral);

module.exports = router;
