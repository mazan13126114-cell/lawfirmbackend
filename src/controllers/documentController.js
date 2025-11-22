// src/controllers/documentController.js
const { prisma } = require('../config/prisma');
const path = require('path');
const fs = require('fs');

// @desc    Upload document to case
// @route   POST /api/documents/upload
// @access  Private
const uploadDocument = async (req, res, next) => {
  try {
    const { caseId, documentType, description } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify case exists and user has access
    const caseData = await prisma.case.findUnique({
      where: { id: parseInt(caseId) }
    });

    if (!caseData) {
      // Delete uploaded file if case not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Check authorization
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

    // Create document record
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
        uploader: {
          select: { id: true, name: true, role: true }
        },
        case: {
          select: { id: true, title: true, caseNumber: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: { document }
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

// @desc    Upload multiple documents
// @route   POST /api/documents/upload-multiple
// @access  Private
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

    // Verify case
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

    // Check authorization
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

    // Create document records for all files
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
            uploader: {
              select: { id: true, name: true }
            }
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
    if (req.files) {
      req.files.forEach(file => fs.unlinkSync(file.path));
    }
    next(error);
  }
};

// @desc    Get all documents for a case
// @route   GET /api/documents/case/:caseId
// @access  Private
const getCaseDocuments = async (req, res, next) => {
  try {
    const caseId = parseInt(req.params.caseId);
    const userId = req.user.id;

    // Verify case access
    const caseData = await prisma.case.findUnique({
      where: { id: caseId }
    });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    const isAuthorized = 
      caseData.clientId === userId || 
      caseData.lawyerId === userId ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Get documents
    const documents = await prisma.document.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploader: {
          select: { id: true, name: true, role: true }
        },
        verifier: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      success: true,
      data: {
        documents,
        count: documents.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download document
// @route   GET /api/documents/:id/download
// @access  Private
const downloadDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: true
      }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check authorization
    const isAuthorized = 
      document.case.clientId === userId || 
      document.case.lawyerId === userId ||
      req.user.role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to download this document'
      });
    }

    // Check if file exists
    if (!fs.existsSync(document.filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Send file
    res.download(document.filePath, document.originalName);
  } catch (error) {
    next(error);
  }
};

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private
const deleteDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: true
      }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Only uploader, assigned lawyer, or admin can delete
    const canDelete = 
      document.uploadedBy === userId ||
      document.case.lawyerId === userId ||
      req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this document'
      });
    }

    // Delete file from filesystem
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId }
    });

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify document (Lawyer/Admin only)
// @route   PUT /api/documents/:id/verify
// @access  Private (Lawyer/Admin)
const verifyDocument = async (req, res, next) => {
  try {
    const documentId = parseInt(req.params.id);
    const userId = req.user.id;

    if (req.user.role !== 'lawyer' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only lawyers and admins can verify documents'
      });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { case: true }
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Lawyer can only verify documents from their cases
    if (req.user.role === 'lawyer' && document.case.lawyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to verify this document'
      });
    }

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        isVerified: true,
        verifiedBy: userId,
        verifiedAt: new Date()
      },
      include: {
        uploader: {
          select: { id: true, name: true }
        },
        verifier: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({
      success: true,
      message: 'Document verified successfully',
      data: { document: updatedDocument }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload profile picture
// @route   POST /api/documents/profile-picture
// @access  Private
const uploadProfilePicture = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Get user's old profile picture
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePicture: true }
    });

    // Delete old profile picture if exists
    if (user.profilePicture && fs.existsSync(user.profilePicture)) {
      fs.unlinkSync(user.profilePicture);
    }

    // Update user with new profile picture
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        profilePicture: req.file.path
      },
      select: {
        id: true,
        name: true,
        email: true,
        profilePicture: true
      }
    });

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
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