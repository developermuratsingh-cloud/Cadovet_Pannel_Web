const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const roleController = require('../controllers/roleController');
const { authenticateUser, authorizePermission, authorizeAnyPermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);
// The permission model is for whoever manages roles or users; customers, doctors and desk staff get 403.
router.use(authorizeAnyPermission('ROLE_MANAGE', 'PERMISSION_MANAGE', 'USER_CREATE'));

router.get('/', roleController.listRoles);
router.post('/', authorizePermission('ROLE_MANAGE'), roleController.createRole);
router.get('/:id', roleController.getRole);
router.put('/:id/permissions', authorizePermission('PERMISSION_MANAGE'), roleController.assignPermissions);

module.exports = router;
