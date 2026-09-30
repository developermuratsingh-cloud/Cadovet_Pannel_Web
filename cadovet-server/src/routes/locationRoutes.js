const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authenticateUser, authorizePermission, blockRole } = require('../middleware/authMiddleware');

router.get('/public', locationController.listPublicLocations);

router.use(authenticateUser);
router.use(blockRole('CUSTOMER'));

router.get('/', locationController.listLocations);
router.get('/:id/staff', authorizePermission('LOCATION_MANAGE'), locationController.listLocationStaff);
router.post('/', authorizePermission('LOCATION_MANAGE'), locationController.createLocation);
router.put('/:id', authorizePermission('LOCATION_MANAGE'), locationController.updateLocation);
router.patch('/:id/status', authorizePermission('LOCATION_MANAGE'), locationController.toggleStatus);

module.exports = router;
