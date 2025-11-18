// src/routes/caseRoutes.js
const express = require('express');
const router = express.Router();

// Cases endpoints not implemented yet. Return 501 to indicate not implemented.
router.get('/', (req, res) => {
  res.status(501).json({ success: false, message: 'Cases endpoint not implemented' });
});

module.exports = router;
