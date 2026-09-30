const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const userController = require('../controllers/userController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);

router.get('/', authorizePermission('USER_CREATE'), userController.listUsers);
router.post('/', authorizePermission('USER_CREATE'), userController.createUser);
router.get('/:id', authorizePermission('USER_CREATE'), userController.getUser);
router.put('/:id', authorizePermission('USER_UPDATE'), userController.updateUser);
router.post('/:id/reset-password', authorizePermission('USER_UPDATE'), userController.resetUserPassword);
router.patch('/:id/status', authorizePermission('USER_UPDATE'), userController.toggleStatus);

module.exports = router;
