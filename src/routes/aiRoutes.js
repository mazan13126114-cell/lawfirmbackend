// src/routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const {
  chatWithAI,
  getAILegalAdvice,
  predictCaseSuccess,
  getAIHistory,
  analyzeDocumentAI
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
// Get legal advice from AI
// -----------------------
// Provides legal guidance based on user query and optionally links to a case or chat

router.post('/legal-advice', [
  body('query')
    .trim()
    .notEmpty()
    .withMessage('Legal query is required'), // query cannot be empty
  body('chatId')
    .optional()
    .isString(), // optional chat session
  body('caseId')
    .optional()
    .isInt()
    .withMessage('Case ID must be a number'), // optional linked case
  validate
], getAILegalAdvice);

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

// -----------------------
// Analyze document with AI
// -----------------------
// Takes a document summary and analyzes it with AI

router.post('/analyze-document', [
  body('documentSummary')
    .trim()
    .notEmpty()
    .withMessage('Document summary is required'), // cannot be empty
  body('caseId')
    .optional()
    .isInt(), // optional linked case
  body('chatId')
    .optional()
    .isString(), // optional chat session
  validate
], analyzeDocumentAI);

// -----------------------
// Get AI history
// -----------------------
// Returns previous AI interactions for the authenticated user

router.get('/history', getAIHistory);

module.exports = router;
