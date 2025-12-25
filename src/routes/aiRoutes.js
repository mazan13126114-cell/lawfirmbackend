// src/routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const {
  chatWithAI,
  predictCaseSuccess,
} = require('../controllers/aiController');

const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

// =======================
// AI ROUTES
// =======================
// All routes below require the user to be authenticated

router.use(protect);

// -----------------------
// Chat with AI
// -----------------------
// Sends a user message to AI and returns AI response

router.post('/chat', [
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required'), // message cannot be empty
  body('chatId')
    .optional()
    .isString(), // optional chat session ID
  validate
], chatWithAI);

// -----------------------
// Predict case success
// -----------------------
// Uses AI to predict the probability of a case's success based on details

router.post('/predict-case', [
  body('caseId')
    .optional()
    .isInt()
    .withMessage('Case ID must be a number'),
  body('title')
    .optional()
    .trim()
    .notEmpty(), // title must not be empty if provided
  body('description')
    .optional()
    .trim()
    .notEmpty(), // description must not be empty if provided
  body('caseType')
    .optional()
    .isIn(['civil', 'criminal', 'corporate', 'family', 'property', 'labor', 'other']), // validate case type
  validate
], predictCaseSuccess);

module.exports = router;
