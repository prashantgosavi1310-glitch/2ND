// =====================================================================
// Multer upload middleware.
// Mirrors the frontend's own client-side limits (register.js:
// MAX_IMAGE_MB / MAX_PDF_MB / MAX_MESS_PHOTOS) — keep these in sync if
// either side changes, or the two will disagree about what's valid.
// =====================================================================
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const MAX_IMAGE_MB = Number(process.env.MAX_IMAGE_MB || 5);
const MAX_PDF_MB = Number(process.env.MAX_PDF_MB || 8);
const MAX_MESS_PHOTOS = Number(process.env.MAX_MESS_PHOTOS || 6);

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const PDF_MIME_TYPE = "application/pdf";

// fieldname -> upload subfolder, matching backend/uploads/<folder>
const FIELD_FOLDERS = {
  ownerPhoto: "owners",
  messPhotos: "mess",
  kitchenPhoto: "kitchen",
  diningPhoto: "dining",
  userPhoto: "users",
  collegeId: "users", // college ID belongs to the user record; kept alongside userPhoto
};

// fieldname -> whether a PDF is allowed in addition to images
const ALLOWS_PDF = { collegeId: true };

const UPLOAD_ROOT = path.resolve("uploads");

function ensureFolder(folder) {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const folder = FIELD_FOLDERS[file.fieldname];
    if (!folder) return cb(new Error("UNKNOWN_UPLOAD_FIELD"));
    cb(null, ensureFolder(folder));
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, unique);
  },
});

function fileFilter(req, file, cb) {
  const isImage = IMAGE_MIME_TYPES.includes(file.mimetype);
  const isAllowedPdf = ALLOWS_PDF[file.fieldname] && file.mimetype === PDF_MIME_TYPE;

  if (!isImage && !isAllowedPdf) {
    const err = new Error(
      ALLOWS_PDF[file.fieldname]
        ? "Only JPG, PNG, WEBP images or PDF files are allowed."
        : "Only JPG, PNG or WEBP images are allowed."
    );
    err.code = "INVALID_FILE_TYPE";
    return cb(err);
  }
  cb(null, true);
}

// Multer's own `limits.fileSize` can only hold one number, so it's set
// to the larger of the two (PDF) allowances; the per-mimetype limit is
// enforced precisely afterward by enforceFileSizeLimits below.
const sharedLimits = {
  fileSize: Math.max(MAX_IMAGE_MB, MAX_PDF_MB) * 1024 * 1024,
};

export const uploadUserFiles = multer({ storage, fileFilter, limits: sharedLimits }).fields([
  { name: "userPhoto", maxCount: 1 },
  { name: "collegeId", maxCount: 1 },
]);

export const uploadMessFiles = multer({ storage, fileFilter, limits: sharedLimits }).fields([
  { name: "ownerPhoto", maxCount: 1 },
  { name: "messPhotos", maxCount: MAX_MESS_PHOTOS },
  { name: "kitchenPhoto", maxCount: 1 },
  { name: "diningPhoto", maxCount: 1 },
]);

/**
 * Runs after multer has written files to disk. Deletes and rejects any
 * file that exceeds its type-specific limit (multer's own limit only
 * caught the larger, shared ceiling). Attach immediately after
 * uploadUserFiles / uploadMessFiles in the route chain.
 */
export function enforceFileSizeLimits(req, res, next) {
  if (!req.files) return next();

  const offenders = [];
  for (const fieldFiles of Object.values(req.files)) {
    for (const file of fieldFiles) {
      const isPdf = file.mimetype === PDF_MIME_TYPE;
      const maxBytes = (isPdf ? MAX_PDF_MB : MAX_IMAGE_MB) * 1024 * 1024;
      if (file.size > maxBytes) offenders.push(file);
    }
  }

  if (offenders.length === 0) return next();

  // Clean up every uploaded file for this request — partial uploads
  // should never be left on disk or referenced in the database.
  for (const fieldFiles of Object.values(req.files)) {
    for (const file of fieldFiles) {
      fs.unlink(file.path, () => {});
    }
  }

  const err = new Error(
    `${offenders[0].fieldname} exceeds the maximum allowed file size.`
  );
  err.code = "LIMIT_FILE_SIZE";
  return next(err);
}

/** Deletes any files multer already wrote to disk for a request that later fails validation/DB insert. */
export function cleanupUploadedFiles(files) {
  if (!files) return;
  for (const fieldFiles of Object.values(files)) {
    for (const file of fieldFiles) {
      fs.unlink(file.path, () => {});
    }
  }
}

/** Portable, DB-storable path like "uploads/owners/171234-abc.jpg" — never the absolute disk path. */
export function relativeUploadPath(file) {
  const folder = FIELD_FOLDERS[file.fieldname];
  return path.posix.join("uploads", folder, file.filename);
}
