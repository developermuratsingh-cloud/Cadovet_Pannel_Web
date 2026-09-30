const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticateUser, authorizeAnyPermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);
router.use(authorizeAnyPermission('ROLE_MANAGE', 'PERMISSION_MANAGE', 'USER_CREATE'));

router.get('/', permissionController.listPermissions);
router.get('/departments', permissionController.listDepartments);

module.exports = router;
