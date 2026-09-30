const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const inventoryController = require('../controllers/inventoryController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);

// Doctor's own dispense/usage log, and the report-an-issue workflow — declared before the generic "/:id" routes
// below, since Express would otherwise try to match "transactions" or "disputes" as a numeric :id and 400 first.
router.get('/transactions', inventoryController.listTransactions);
router.post('/transactions/:id/dispute', inventoryController.raiseDispute);
router.post('/upload-slip-image', authorizePermission('INVENTORY_MANAGE'), inventoryController.uploadSlipImageMiddleware, inventoryController.uploadSlipImage);

router.get('/disputes', inventoryController.listDisputes);
// forward/dismiss are the operational head's verification step — no single existing permission means exactly
// "ops or admin", so the role check lives in the controller instead of here.
router.patch('/disputes/:id/forward', inventoryController.forwardDispute);
router.patch('/disputes/:id/dismiss', inventoryController.dismissDispute);
router.patch('/disputes/:id/resolve', authorizePermission('INVENTORY_MANAGE'), inventoryController.resolveDispute);

// List inventory items
router.get('/', authorizePermission('INVENTORY_VIEW'), inventoryController.listInventory);

// Get single item
router.get('/:id', authorizePermission('INVENTORY_VIEW'), inventoryController.getInventoryItemById);

// Create item
router.post('/', authorizePermission('INVENTORY_MANAGE'), inventoryController.createInventoryItem);

// Update item
router.put('/:id', authorizePermission('INVENTORY_MANAGE'), inventoryController.updateInventoryItem);

// Adjust stock delta
router.patch('/:id/adjust-stock', authorizePermission('INVENTORY_MANAGE'), inventoryController.adjustStock);

// Dispense stock to a doctor's bag (Pharmacy/Inventory desk, or ops/admin)
router.post('/:id/dispense', authorizePermission('INVENTORY_MANAGE'), inventoryController.dispenseToDoctor);

// A doctor logging what they used on a visit (doctor-only check lives in the controller)
router.post('/:id/use', inventoryController.useOnPatient);

// Delete item
router.delete('/:id', authorizePermission('INVENTORY_MANAGE'), inventoryController.deleteInventoryItem);

module.exports = router;
