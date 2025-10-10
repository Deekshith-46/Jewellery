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

module.exports = upload;
