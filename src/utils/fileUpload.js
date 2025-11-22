// src/config/fileUpload.js

const multer = require('multer'); // Middleware to handle multipart/form-data (file uploads)
const path = require('path'); // Node module to handle file paths
const fs = require('fs'); // Node module to interact with the file system

// ===== FOLDER SETUP =====
// Define directories for uploads
const uploadsDir = './uploads';
const documentsDir = './uploads/documents';
const profilesDir = './uploads/profiles';

// Create directories if they do not exist
[uploadsDir, documentsDir, profilesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true }); // recursive:true creates nested folders if needed
  }
});

// ===== DOCUMENT STORAGE CONFIG =====
const documentStorage = multer.diskStorage({
  // Destination folder for uploaded documents
  destination: function (req, file, cb) {
    cb(null, documentsDir);
  },
  // Generate unique filename to avoid conflicts
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname); // Get file extension
    const nameWithoutExt = path.basename(file.originalname, ext); // Get original name without extension
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_'); // Replace unsafe chars with _
    cb(null, `doc-${uniqueSuffix}-${sanitizedName}${ext}`); // Final filename
  }
});

// ===== PROFILE PICTURE STORAGE CONFIG =====
const profileStorage = multer.diskStorage({
  // Destination folder for profile pictures
  destination: function (req, file, cb) {
    cb(null, profilesDir);
  },
  // Generate unique filename
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname); // Keep original extension
    cb(null, `profile-${uniqueSuffix}${ext}`); // Final filename format
  }
});

// ===== FILE FILTERS =====

// Allowed document types
const documentFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'text/plain'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, and TXT files are allowed.'), false); // Reject file
  }
};

// Allowed image types for profile pictures
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, and PNG images are allowed.'), false); // Reject file
  }
};

// ===== MULTER UPLOAD INSTANCES =====

// Single document upload (max 10MB)
const uploadDocument = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Single profile picture upload (max 2MB)
const uploadProfilePicture = multer({
  storage: profileStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Multiple documents upload (up to 5 files, each max 10MB)
const uploadMultipleDocuments = multer({
  storage: documentStorage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 5 // Maximum 5 files per request
  }
});

// ===== EXPORT MODULES =====
module.exports = {
  uploadDocument,           // Middleware for single document upload
  uploadProfilePicture,     // Middleware for profile picture upload
  uploadMultipleDocuments,  // Middleware for multiple documents upload
  documentsDir,             // Export document folder path
  profilesDir               // Export profile picture folder path
};
