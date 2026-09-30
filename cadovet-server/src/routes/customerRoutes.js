const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const customerController = require('../controllers/customerController');
const { authenticateUser, authorizePermission, blockRole } = require('../middleware/authMiddleware');

router.use(authenticateUser);
router.use(blockRole('DOCTOR'));

router.get('/', authorizePermission('CUSTOMER_VIEW'), customerController.listCustomers);
router.post('/', authorizePermission('CUSTOMER_CREATE'), customerController.createCustomer);
router.get('/:id', authorizePermission('CUSTOMER_VIEW'), customerController.getCustomer);
router.put('/:id', authorizePermission('CUSTOMER_UPDATE'), customerController.updateCustomer);
router.patch('/:id/status', authorizePermission('CUSTOMER_UPDATE'), customerController.toggleStatus);

module.exports = router;
