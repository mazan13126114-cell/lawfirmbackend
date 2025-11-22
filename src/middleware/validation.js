const { body, param, query, validationResult } = require('express-validator');

// =======================
// Validation Result Handler
// =======================
//     Handle validation errors returned by express-validator

const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }

  next();
};

// =======================
// USER VALIDATIONS
// =======================

// Register validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter'),
  
  body('role')
    .optional()
    .isIn(['client', 'lawyer', 'admin']).withMessage('Role must be one of: client, lawyer, or admin'),
  
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]*$/).withMessage('Invalid phone number format'),

  validate
];

// Login validation
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required'),

  validate
];

// Forgot password validation
const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email address')
    .normalizeEmail(),

  validate
];

// Reset password validation
const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  validate
];

// Update profile validation
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]*$/).withMessage('Invalid phone number format'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  
  body('specialization')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Specialization must be less than 255 characters'),

  validate
];

// Change password validation
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain at least one letter'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),

  validate
];

// =======================
// CASE VALIDATIONS
// =======================

// Create case validation
const createCaseValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Case title is required')
    .isLength({ min: 5, max: 255 }).withMessage('Title must be between 5 and 255 characters'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Case description is required')
    .isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  
  body('caseType')
    .notEmpty().withMessage('Case type is required')
    .isIn(['civil', 'criminal', 'corporate', 'family', 'property', 'labor', 'other'])
    .withMessage('Invalid case type'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),

  validate
];

// Update case validation
const updateCaseValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 5, max: 255 }).withMessage('Title must be between 5 and 255 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
  
  body('status')
    .optional()
    .isIn(['pending', 'assigned', 'ongoing', 'review', 'closed', 'rejected'])
    .withMessage('Invalid status'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  
  body('caseType')
    .optional()
    .isIn(['civil', 'criminal', 'corporate', 'family', 'property', 'labor', 'other'])
    .withMessage('Invalid case type'),

  validate
];

// Assign lawyer validation
const assignLawyerValidation = [
  body('lawyerId')
    .optional()
    .isInt().withMessage('Lawyer ID must be a number'),

  validate
];

// =======================
// MESSAGE VALIDATIONS
// =======================

// Send message validation
const sendMessageValidation = [
  body('receiverId')
    .notEmpty().withMessage('Receiver ID is required')
    .isInt().withMessage('Receiver ID must be a number'),
  
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 5000 }).withMessage('Message must be between 1 and 5000 characters'),
  
  body('caseId')
    .optional()
    .isInt().withMessage('Case ID must be a number'),
  
  body('messageType')
    .optional()
    .isIn(['text', 'file', 'notification', 'system'])
    .withMessage('Invalid message type'),
  
  body('attachmentUrl')
    .optional()
    .isURL().withMessage('Invalid attachment URL'),

  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
  changePasswordValidation,
  createCaseValidation,
  updateCaseValidation,
  assignLawyerValidation,
  sendMessageValidation
};
