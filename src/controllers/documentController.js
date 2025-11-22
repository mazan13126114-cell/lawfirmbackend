// src/controllers/documentController.js
const { prisma } = require('../config/prisma');
const path = require('path');
const fs = require('fs');

// =======================
// Upload a single document to a case
// =======================

const uploadDocument = async (req, res, next) => {
  try {
    const { caseId, documentType, description } = req.body;
    const userId = req.user.id;

    // Ensure a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate case existence
    const caseData = await prisma.case.findUnique({
      where: { id: parseInt(caseId) } // <-- parse to avoid string injection
    });

    if (!caseData) {
      fs.unlinkSync(req.file.path); // cleanup uploaded file if case invalid
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Check authorization: only client, assigned lawyer, or admin
    const isAuthorized = 
      caseData.clientId === userId || 
      caseData.lawyerId === userId ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload documents for this case'
      });
    }

    // Save document in database
    const document = await prisma.document.create({
      data: {
        caseId: parseInt(caseId),
        uploadedBy: userId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        documentType: documentType || 'other',
        description: description || null
      },
      include: {
        uploader: { select: { id: true, name: true, role: true } },
        case: { select: { id: true, title: true, caseNumber: true } }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { document }
    });
  } catch (error) {
    // Remove uploaded file if any error occurs
    if (req.file) fs.unlinkSync(req.file.path);
    next(error);
  }
};

// =======================
// Upload multiple documents
// =======================

const uploadMultipleDocuments = async (req, res, next) => {
  try {
    const { caseId, documentType, description } = req.body;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Validate case
    const caseData = await prisma.case.findUnique({
      where: { id: parseInt(caseId) }
    });

    if (!caseData) {
      req.files.forEach(file => fs.unlinkSync(file.path));
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Authorization check
    const isAuthorized = 
      caseData.clientId === userId || 
      caseData.lawyerId === userId ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      req.files.forEach(file => fs.unlinkSync(file.path));
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Save all files to DB
    const documents = await Promise.all(
      req.files.map(file =>
        prisma.document.create({
          data: {
            caseId: parseInt(caseId),
            uploadedBy: userId,
            filename: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            documentType: documentType || 'other',
            description: description || null
          },
          include: {
            uploader: { select: { id: true, name: true } }
          }
        })
      )
    );

    res.status(201).json({
      success: true,
      message: `${documents.length} documents uploaded successfully`,
      data: { documents }
    });
  } catch (error) {
    if (req.files) req.files.forEach(file => fs.unlinkSync(file.path));
    next(error);
  }
};

// =======================
// Get all documents for a case
// =======================

const getCaseDocuments = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId);
    const userId = req.user.id;

    // Verify case exists
    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    // Authorization check
    const isAuthorized = 
      caseData.clientId === userId || 
      caseData.lawyerId === userId ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Get documents with uploader & verifier info
    const documents = await prisma.document.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: { select: { id: true, name: true, role: true } },
        verifier: { select: { id: true, name: true } }
      }
    });

    res.json({ success: true, data: { documents, count: documents.length } });
  } catch (error) {
    next(error);
  }
};

// =======================
// Download document
// =======================

const downloadDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { case: true }
    });

    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

    // Authorization: only uploader, assigned lawyer, client, or admin
    const isAuthorized = 
      document.case.clientId === userId || 
      document.case.lawyerId === userId ||
      req.user.role === 'admin';

    if (!isAuthorized) return res.status(403).json({ success: false, message: 'Not authorized' });

    // File existence check
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
};

// =======================
// Delete document
// =======================

const deleteDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { case: true }
    });

    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

    // Only uploader, assigned lawyer, or admin can delete
    const canDelete = 
      document.uploadedBy === userId ||
      document.case.lawyerId === userId ||
      req.user.role === 'admin';

    if (!canDelete) return res.status(403).json({ success: false, message: 'Not authorized' });

    // Delete file from filesystem if exists
    if (fs.existsSync(document.filePath)) fs.unlinkSync(document.filePath);

    // Delete from database
    await prisma.document.delete({ where: { id: documentId } });

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// =======================
// Verify document
// =======================

const verifyDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user.id;

    // Only lawyers/admins
    if (req.user.role !== 'lawyer' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only lawyers and admins can verify documents' });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { case: true }
    });

    if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

    // Lawyer can only verify their own cases
    if (req.user.role === 'lawyer' && document.case.lawyerId !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to verify this document' });
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: { isVerified: true, verifiedBy: userId, verifiedAt: new Date() },
      include: {
        uploader: { select: { id: true, name: true } },
        verifier: { select: { id: true, name: true } }
      }
    });

    res.json({ success: true, message: 'Document verified successfully', data: { document: updatedDocument } });
  } catch (error) {
    next(error);
  }
};

// =======================
// Upload profile picture
// =======================

const uploadProfilePicture = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Remove old profile picture if exists
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { profilePicture: true } });
    if (user.profilePicture && fs.existsSync(user.profilePicture)) fs.unlinkSync(user.profilePicture);

    // Update user with new profile picture
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: req.file.path },
      select: { id: true, name: true, email: true, profilePicture: true }
    });

    res.json({ success: true, message: 'Profile picture uploaded successfully', data: { user: updatedUser } });
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(error);
  }
};

module.exports = {
  uploadDocument,
  uploadMultipleDocuments,
  getCaseDocuments,
  downloadDocument,
  deleteDocument,
  verifyDocument,
  uploadProfilePicture
};
