const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);
router.get('/', authorizePermission('REPORT_VIEW'), auditController.listAuditLogs);

module.exports = router;
