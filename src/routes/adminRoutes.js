
const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUser,
  deleteUser,
  getAllCasesAdmin,
  assignLawyerToCase,
  deleteCaseAdmin,

} = require('../controllers/adminController');

const { body } = require('express-validator');
const { validate } = require('../middleware/validation');
const { protect } = require('../middleware/auth'); // ✅ Must be imported

// =======================
// ADMIN ROUTES
// =======================
// All routes below are protected: user must be logged in and have admin role
router.use(protect);             // Ensure JWT token is valid

// -----------------------
// Dashboard & Statistics
// -----------------------
// Get overall dashboard statistics

router.get('/dashboard', getDashboardStats);


// -----------------------
// User Management
// -----------------------
// Get all users in the system

router.get('/users', getAllUsers);

// Get details of a specific user by ID

router.get('/users/:id', getUserDetails);

// Update a specific user (role, active status, verification)
router.put('/users/:id', [
  body('isActive').optional().isBoolean(), // Must be boolean if provided
  body('role').optional().isIn(['client', 'lawyer', 'admin']), // Role validation
  body('isVerified').optional().isBoolean(), // Verification flag must be boolean
  validate
], updateUser);

// Delete a user (delete handled in controller)

router.delete('/users/:id', deleteUser);

// -----------------------
// Case Management
// -----------------------
// Get all cases across the system (admin view)

router.get('/cases', getAllCasesAdmin);

// Assign a lawyer to a case

router.put('/cases/:id/assign', [
  body('lawyerId').isInt().withMessage('Lawyer ID is required'), // Must provide a numeric lawyer ID
  validate
], assignLawyerToCase);

// Delete a case (admin only)

router.delete('/cases/:id', deleteCaseAdmin);



module.exports = router;
