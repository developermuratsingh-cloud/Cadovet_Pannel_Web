const express = require('express');
const router = express.Router();
const membershipController = require('../controllers/membershipController');

router.get('/', membershipController.listOffers);

module.exports = router;
