const express = require('express');
const router = express.Router();
const { getLawyers } = require('../controllers/lawyerController');

// Public endpoint to list lawyers (filter by specialization/search)
router.get('/', getLawyers);

module.exports = router;
