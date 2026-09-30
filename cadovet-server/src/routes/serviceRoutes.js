const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const serviceController = require('../controllers/serviceController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

// Public services list
router.get('/public', serviceController.listPublicServices);

router.use(authenticateUser);

router.get('/', authorizePermission('SERVICE_VIEW'), serviceController.listServices);
router.post('/', authorizePermission('SERVICE_MANAGE'), serviceController.createService);
router.post('/upload-image', authorizePermission('SERVICE_MANAGE'), serviceController.uploadImageMiddleware, serviceController.uploadServiceImage);
router.put('/:id', authorizePermission('SERVICE_MANAGE'), serviceController.updateService);

module.exports = router;
