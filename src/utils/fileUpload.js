// fileUpload stubs — upload feature removed
// Export middleware stubs that return 410 Gone so existing imports won't break
const handler410 = (req, res, next) => res.status(410).json({ success: false, message: 'File upload feature removed' });

const stubSingle = (field) => (req, res, next) => handler410(req, res, next);
const stubArray = (field, n) => (req, res, next) => handler410(req, res, next);

module.exports = {
  uploadDocument: { single: (f) => stubSingle(f) },
  uploadMultipleDocuments: { array: (f, n) => stubArray(f, n) },
  uploadProfilePicture: { single: (f) => stubSingle(f) },
  documentsDir: './uploads/documents',
  profilesDir: './uploads/profiles'
};
