// =====================================================================
// Validation middleware — express-validator chains per route, plus a
// shared `validate` gate that turns accumulated errors into a single
// 400 response. Rules mirror the frontend's own validation
// (register.js) so both layers agree on what "valid" means.
// =====================================================================
import { body, validationResult } from "express-validator";
import { errorResponse } from "../utils/response.js";
import { cleanupUploadedFiles } from "./upload.js";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const OTP_REGEX = /^\d{6}$/;

// Runs after Multer on the register routes — if validation fails here,
// any files Multer already wrote to disk for this request would
// otherwise be orphaned, since the controller (which normally owns
// cleanup) never runs. Safe to call on JSON-only routes too: req.files
// is simply undefined there and cleanupUploadedFiles() no-ops.
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  cleanupUploadedFiles(req.files);
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return errorResponse(res, 400, "Please check the details you entered and try again.", errors);
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
export const sendOtpValidation = [
  body("email").trim().notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Enter a valid email address.")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),
];

export const verifyOtpValidation = [
  body("email").trim().notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Enter a valid email address.")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),
  body("otp").trim().notEmpty().withMessage("OTP is required.")
    .matches(OTP_REGEX).withMessage("OTP must be a 6-digit code."),
];

export const loginValidation = [
  body("email").trim().notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Enter a valid email address.")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),
  body("password").notEmpty().withMessage("Password is required."),
];

// ---------------------------------------------------------------------
// User registration
// (multipart/form-data — express-validator still reads req.body fields
// that multer has already parsed by the time this middleware runs)
// ---------------------------------------------------------------------
export const userRegisterValidation = [
  body("fullName").trim().notEmpty().withMessage("Full name is required."),
  body("collegeName").trim().notEmpty().withMessage("College name is required."),
  body("rollNumber").trim().notEmpty().withMessage("Roll number is required."),
  body("mobile").trim().notEmpty().withMessage("Mobile number is required.")
    .customSanitizer((v) => v.replace(/\s+/g, ""))
    .matches(MOBILE_REGEX).withMessage("Enter a valid 10-digit mobile number."),
  body("email").trim().notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Enter a valid email address.")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),
  body("password").notEmpty().withMessage("Password is required.")
    .matches(PASSWORD_REGEX)
    .withMessage("Password must be at least 8 characters and include a letter and a number."),
];

// ---------------------------------------------------------------------
// Mess owner registration
// ---------------------------------------------------------------------
export const messRegisterValidation = [
  body("ownerName").trim().notEmpty().withMessage("Owner name is required."),
  body("mobile").trim().notEmpty().withMessage("Mobile number is required.")
    .customSanitizer((v) => v.replace(/\s+/g, ""))
    .matches(MOBILE_REGEX).withMessage("Enter a valid 10-digit mobile number."),
  body("email").trim().notEmpty().withMessage("Email is required.")
    .isEmail().withMessage("Enter a valid email address.")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
      outlookdotcom_remove_subaddress: false,
      yahoo_remove_subaddress: false,
      icloud_remove_subaddress: false,
    }),
  body("password").notEmpty().withMessage("Password is required.")
    .matches(PASSWORD_REGEX)
    .withMessage("Password must be at least 8 characters and include a letter and a number."),

  body("messName").trim().notEmpty().withMessage("Mess name is required."),
  body("address").trim().notEmpty().withMessage("Mess address is required."),
  body("city").trim().notEmpty().withMessage("City is required."),
  body("pincode").trim().notEmpty().withMessage("Pincode is required.")
    .matches(PINCODE_REGEX).withMessage("Enter a valid 6-digit pincode."),
  body("mapLink").optional({ checkFalsy: true }).trim()
    .isURL().withMessage("Enter a valid map link URL."),

  body("vegType").optional().trim().isIn(["veg", "nonveg", "both"])
    .withMessage("Veg type must be veg, nonveg, or both."),

  body("monthlyFees").notEmpty().withMessage("Monthly fees is required.")
    .isFloat({ min: 0 }).withMessage("Monthly fees must be a positive number."),
  body("dailyFoodPrice").optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage("Daily food price must be a positive number."),
  body("securityDeposit").optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage("Security deposit must be a positive number."),
  body("capacity").notEmpty().withMessage("Capacity is required.")
    .isInt({ min: 1 }).withMessage("Capacity must be at least 1."),
  body("availableSeats").notEmpty().withMessage("Available seats is required.")
    .isInt({ min: 0 }).withMessage("Available seats must be zero or more.")
    .custom((value, { req }) => {
      const capacity = Number(req.body.capacity);
      if (!Number.isNaN(capacity) && Number(value) > capacity) {
        throw new Error("Available seats cannot exceed capacity.");
      }
      return true;
    }),
];
