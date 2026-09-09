const multer = require("multer");
const { AppError } = require("./error.middleware");

// Allowed MIME types per PRD: JPG and PNG
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png)$/i;

// 10 MB in bytes
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Multer configuration using memory storage.
 * Files are stored in buffer for hashing and Supabase upload.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isExtAllowed = ALLOWED_EXTENSIONS.test(file.originalname);

    if (!isMimeAllowed || !isExtAllowed) {
      return cb(
        new AppError(
          "Unsupported file type. Please upload JPG or PNG.",
          400,
          "UNSUPPORTED_FILE_TYPE",
        ),
      );
    }

    cb(null, true);
  },
});

module.exports = { upload };
