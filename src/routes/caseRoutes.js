const express = require('express');
const router = express.Router();

const {
  createCase,
  getAllCases,
  getCaseById,
  updateCase,
  deleteCase,
  assignLawyer,
  getCaseStats,
  getPendingRequests,
  rejectCaseRequest
} = require('../controllers/caseController');

const { protect, authorize } = require('../middleware/auth');

// All case routes require authentication
router.use(protect);

// Create a new case (clients)
router.post('/', createCase);

// List cases (role-aware)
router.get('/', getAllCases);

// Get pending unassigned case requests (for lawyers to review)
router.get('/requests', authorize('lawyer'), getPendingRequests);

// Accept (assign) a case to current lawyer
router.put('/:id/assign', authorize('lawyer', 'admin'), assignLawyer);

// Reject a pending case request
router.put('/:id/reject', authorize('lawyer', 'admin'), rejectCaseRequest);

// Get case details
router.get('/:id', getCaseById);

// Update a case
router.put('/:id', updateCase);

// Delete a case
router.delete('/:id', deleteCase);

// Case statistics
router.get('/stats', getCaseStats);

module.exports = router;
