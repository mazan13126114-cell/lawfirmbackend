// src/routes/adminRoutes.js
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
  getAIStats,
  getActivityLogs
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard & Statistics
router.get('/dashboard', getDashboardStats);
router.get('/ai-stats', getAIStats);
router.get('/activity', getActivityLogs);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', [
  body('isActive').optional().isBoolean(),
  body('role').optional().isIn(['client', 'lawyer', 'admin']),
  body('isVerified').optional().isBoolean(),
  validate
], updateUser);
router.delete('/users/:id', deleteUser);

// Case Management
router.get('/cases', getAllCasesAdmin);
router.put('/cases/:id/assign', [
  body('lawyerId').isInt().withMessage('Lawyer ID is required'),
  validate
], assignLawyerToCase);
router.delete('/cases/:id', deleteCaseAdmin);

module.exports = router;