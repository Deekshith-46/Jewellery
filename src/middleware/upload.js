const multer = require('multer');

const storage = multer.memoryStorage();

// Default uploader: image-only
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// Excel uploader: allow xlsx/xls/csv
const allowedExcelTypes = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv',
  'application/csv',
  'text/plain'
]);

upload.excel = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedExcelTypes.has(file.mimetype)) {
      return cb(new Error('Only Excel/CSV files are allowed'), false);
    }
    cb(null, true);
  }
});

// Optional upload middleware - only applies multer if content-type is multipart/form-data
// This allows the same route to accept both JSON and form-data
// Allows text fields in form-data while optionally accepting a file
// Also handles cases where image_url might be sent as a file instead of text
upload.optional = (fieldName, alternativeFieldName = null) => {
  return (req, res, next) => {
    const contentType = req.get('content-type') || '';
    
    // Only apply multer if it's multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      // Use .any() to accept all fields (both files and text fields)
      // Text fields will be in req.body, files will be in req.files array
      upload.any()(req, res, (err) => {
        if (err) {
          return next(err);
        }
        
        // Extract the file from req.files array if it matches the field name
        // req.files is an array when using .any()
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
          // Try primary field name first
          let file = req.files.find(f => f.fieldname === fieldName);
          
          // If not found and alternative field name provided, try that
          if (!file && alternativeFieldName) {
            file = req.files.find(f => f.fieldname === alternativeFieldName);
          }
          
          // If still not found, try common alternatives like 'image_url'
          if (!file) {
            file = req.files.find(f => f.fieldname === 'image_url');
          }
          
          if (file) {
            req.file = file;
            // Remove image_url from body if it was sent as a file (to avoid confusion)
            if (req.body && req.body.image_url && file.fieldname === 'image_url') {
              delete req.body.image_url;
            }
          }
        }
        
        // Text fields from form-data are already in req.body by multer
        next();
      });
    } else {
      // Skip multer for JSON requests - express.json() will parse the body
      next();
    }
  };
};

// Optional fields middleware - only applies multer if content-type is multipart/form-data
upload.optionalFields = (fields) => {
  return (req, res, next) => {
    const contentType = req.get('content-type') || '';
    
    // Only apply multer if it's multipart/form-data
    if (contentType.includes('multipart/form-data')) {
      upload.fields(fields)(req, res, next);
    } else {
      // Skip multer for JSON requests
      next();
    }
  };
};

module.exports = upload;
