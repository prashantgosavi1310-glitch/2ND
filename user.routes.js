import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";
import { uploadUserFiles, enforceFileSizeLimits } from "../middleware/upload.js";
import { userRegisterValidation, validate } from "../middleware/validation.js";

const router = Router();

// Order matters: multer must parse the multipart body before
// express-validator can see req.body fields, and file-size enforcement
// must run before validation so an oversized upload short-circuits
// with 413 rather than a confusing 400.
router.post(
  "/register",
  uploadUserFiles,
  enforceFileSizeLimits,
  userRegisterValidation,
  validate,
  registerUser
);

export default router;
