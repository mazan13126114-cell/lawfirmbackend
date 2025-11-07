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

// All AI routes require authentication
router.use(protect);

// Chat with AI
router.post('/chat', [
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('chatId').optional().isString(),
  validate
], chatWithAI);

// Get legal advice
router.post('/legal-advice', [
  body('query').trim().notEmpty().withMessage('Legal query is required'),
  body('chatId').optional().isString(),
  body('caseId').optional().isInt().withMessage('Case ID must be a number'),
  validate
], getAILegalAdvice);

// Predict case success
router.post('/predict-case', [
  body('caseId').optional().isInt().withMessage('Case ID must be a number'),
  body('title').optional().trim().notEmpty(),
  body('description').optional().trim().notEmpty(),
  body('caseType').optional().isIn(['civil', 'criminal', 'corporate', 'family', 'property', 'labor', 'other']),
  validate
], predictCaseSuccess);

// Analyze document
router.post('/analyze-document', [
  body('documentSummary').trim().notEmpty().withMessage('Document summary is required'),
  body('caseId').optional().isInt(),
  body('chatId').optional().isString(),
  validate
], analyzeDocumentAI);

// Get AI history
router.get('/history', getAIHistory);

module.exports = router;