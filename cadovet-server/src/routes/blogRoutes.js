const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');

// Public: articles are marketing/education content, no login required.
router.get('/', blogController.listBlogs);
router.get('/:slug', blogController.getBlog);

module.exports = router;
