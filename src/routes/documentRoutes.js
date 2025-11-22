// src/routes/documentRoutes.js
const express = require('express');
const router = express.Router();
const {
  uploadDocument,
  uploadMultipleDocuments,
  getCaseDocuments,
  downloadDocument,
  deleteDocument,
  verifyDocument,
  uploadProfilePicture
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');
const { 
  uploadDocument: uploadDocMiddleware, 
  uploadMultipleDocuments: uploadMultipleMiddleware,
  uploadProfilePicture: uploadProfileMiddleware
} = require('../config/fileUpload');

// All routes require authentication
router.use(protect);

// Upload single document
router.post(
  '/upload',
  uploadDocMiddleware.single('document'),
  uploadDocument
);

// Upload multiple documents
router.post(
  '/upload-multiple',
  uploadMultipleMiddleware.array('documents', 5),
  uploadMultipleDocuments
);

// Upload profile picture
router.post(
  '/profile-picture',
  uploadProfileMiddleware.single('profilePicture'),
  uploadProfilePicture
);

// Get documents for a case
router.get('/case/:caseId', getCaseDocuments);

// Download document
router.get('/:id/download', downloadDocument);

// Verify document (Lawyer/Admin only)
router.put('/:id/verify', authorize('lawyer', 'admin'), verifyDocument);

// Delete document
router.delete('/:id', deleteDocument);

module.exports = router;