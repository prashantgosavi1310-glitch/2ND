import { Router } from "express";
import { registerMess } from "../controllers/mess.controller.js";
import { uploadMessFiles, enforceFileSizeLimits } from "../middleware/upload.js";
import { messRegisterValidation, validate } from "../middleware/validation.js";

const router = Router();

router.post(
  "/register",
  uploadMessFiles,
  enforceFileSizeLimits,
  messRegisterValidation,
  validate,
  registerMess
);

export default router;
