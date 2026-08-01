// =====================================================================
// Centralized error handler. Every route either responds directly or
// calls next(err); this is the single place that turns any error —
// Multer, Postgres, JWT, or unexpected — into a consistent JSON shape.
// Must be registered LAST, after all routes, in server.js.
// =====================================================================
import multer from "multer";
import { errorResponse } from "../utils/response.js";

export function notFoundHandler(req, res) {
  return errorResponse(res, 404, "The requested resource was not found.");
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Never log secrets — strip anything that looks like a password/otp
  // field before printing, and never print the raw body at all.
  console.error(`[error] ${req.method} ${req.originalUrl} ::`, err.message);

  // Multer file-size / file-count errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return errorResponse(res, 413, "One of your files is too large. Please choose a smaller file.");
    }
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
      return errorResponse(res, 413, "Too many files selected for one of the upload fields.");
    }
    return errorResponse(res, 400, "There was a problem with your file upload.");
  }

  // Our own upload middleware raises these with a .code
  if (err.code === "LIMIT_FILE_SIZE") {
    return errorResponse(res, 413, err.message || "One of your files is too large.");
  }
  if (err.code === "INVALID_FILE_TYPE") {
    return errorResponse(res, 415, err.message || "One of your files isn't a supported file type.");
  }

  // JWT errors that slipped past the auth middleware (e.g. malformed token elsewhere)
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return errorResponse(res, 401, "Invalid or expired session. Please log in again.");
  }

  // Postgres unique-constraint violation (duplicate email/mobile)
  if (err.code === "23505") {
    return errorResponse(res, 409, "That email or mobile number is already registered.");
  }
  // Postgres check-constraint / not-null / foreign-key violations -> bad input
  if (["23502", "23503", "23514", "22P02"].includes(err.code)) {
    return errorResponse(res, 400, "Please check the details you entered and try again.");
  }

  // Payload too large (e.g. express.json() limit)
  if (err.type === "entity.too.large") {
    return errorResponse(res, 413, "The request payload is too large.");
  }

  return errorResponse(res, 500, "Something went wrong on our end. Please try again shortly.");
}
