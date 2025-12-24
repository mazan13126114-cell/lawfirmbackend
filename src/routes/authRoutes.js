const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  resetPasswordSimple,
  logout
} = require('../controllers/authController');

const {
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  changePasswordValidation
} = require('../middleware/validation');

const { protect } = require('../middleware/auth');

// =======================
// AUTH ROUTES
// =======================

// -----------------------
// Public routes
// -----------------------
// User registration

router.post('/register', registerValidation, register);

// User login

router.post('/login', loginValidation, login);

// Request password reset

router.post('/forgot-password', forgotPasswordValidation, forgotPassword);

// Reset password using token

router.post('/reset-password', resetPasswordValidation, resetPassword);

// Simple password reset (without email token)

router.post('/reset-password-simple', resetPasswordSimple);

// -----------------------
// Protected routes (require authentication)
// -----------------------

// Get current logged-in user's profile

router.get('/me', protect, getMe);

// Update profile information

router.put('/profile', protect, updateProfileValidation, updateProfile);

// Change password

router.put('/change-password', protect, changePasswordValidation, changePassword);

// Logout user

router.post('/logout', protect, logout);

module.exports = router;
