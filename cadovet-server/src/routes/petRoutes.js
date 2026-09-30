const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const petController = require('../controllers/petController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

router.use(authenticateUser);

router.get('/', authorizePermission('PET_VIEW'), petController.listPets);
router.post('/', authorizePermission('PET_CREATE'), petController.createPet);
router.get('/:id', authorizePermission('PET_VIEW'), petController.getPet);
router.put('/:id', authorizePermission('PET_UPDATE'), petController.updatePet);
router.delete('/:id', authorizePermission('PET_UPDATE'), petController.deletePet);

module.exports = router;
