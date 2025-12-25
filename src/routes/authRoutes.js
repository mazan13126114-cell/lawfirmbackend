const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
 

  resetPasswordSimple,
  logout
} = require('../controllers/authController');

const {
  registerValidation,
  loginValidation,


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
