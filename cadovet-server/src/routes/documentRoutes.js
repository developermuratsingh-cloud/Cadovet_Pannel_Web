const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const documentController = require('../controllers/documentController');
const { authenticateUser } = require('../middleware/authMiddleware');

// The signed link is the credential here, so this must be declared before authenticateUser.
router.get('/:id/file', documentController.streamDocument);

router.use(authenticateUser);
router.get('/', documentController.listDocuments);
// Authenticate before multer touches the disk.
router.post('/', documentController.uploadMiddleware, documentController.createDocument);
router.get('/:id/link', documentController.getDocumentLink);
router.delete('/:id', documentController.deleteDocument);

module.exports = router;
