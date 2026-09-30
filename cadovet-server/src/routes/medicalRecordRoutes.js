const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const medicalRecordController = require('../controllers/medicalRecordController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);

// List medical records (scoping handled in controller)
router.get('/', authorizePermission('MEDICAL_RECORD_VIEW'), medicalRecordController.listMedicalRecords);

// Get single record
router.get('/:id', authorizePermission('MEDICAL_RECORD_VIEW'), medicalRecordController.getMedicalRecordById);

// Create new clinical record & prescription
router.post('/', authorizePermission('MEDICAL_RECORD_MANAGE'), medicalRecordController.createMedicalRecord);

// Update clinical notes
router.put('/:id', authorizePermission('MEDICAL_RECORD_MANAGE'), medicalRecordController.updateMedicalRecord);

// Delete record
router.delete('/:id', authorizePermission('MEDICAL_RECORD_MANAGE'), medicalRecordController.deleteMedicalRecord);

module.exports = router;
