const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const invoiceController = require('../controllers/invoiceController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);

// List invoices (customers see their own, admin/staff see all)
router.get('/', authorizePermission('INVOICE_VIEW'), invoiceController.listInvoices);

// Get single invoice
router.get('/:id', authorizePermission('INVOICE_VIEW'), invoiceController.getInvoiceById);

// Create invoice
router.post('/', authorizePermission('INVOICE_MANAGE'), invoiceController.createInvoice);

// Update status
router.patch('/:id/status', authorizePermission('INVOICE_MANAGE'), invoiceController.updateInvoiceStatus);

// Delete invoice
router.delete('/:id', authorizePermission('INVOICE_MANAGE'), invoiceController.deleteInvoice);

module.exports = router;
