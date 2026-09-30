const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const doctorController = require('../controllers/doctorController');
const { authenticateUser, authorizePermission, blockRole } = require('../middleware/authMiddleware');

router.get('/public', doctorController.listPublicDoctors);

router.use(authenticateUser);
router.use(blockRole('DOCTOR'));

router.get('/', authorizePermission('DOCTOR_VIEW'), doctorController.listDoctors);
router.post('/', authorizePermission('DOCTOR_CREATE'), doctorController.createDoctor);
router.get('/:id', authorizePermission('DOCTOR_VIEW'), doctorController.getDoctor);
router.put('/:id', authorizePermission('DOCTOR_UPDATE'), doctorController.updateDoctor);

module.exports = router;
