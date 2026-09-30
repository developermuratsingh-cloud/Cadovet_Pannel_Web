const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticateUser } = require('../middleware/authMiddleware');

router.use(authenticateUser);
router.get('/', couponController.listCoupons);
router.post('/validate', couponController.validateCoupon);

module.exports = router;
