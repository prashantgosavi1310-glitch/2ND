// =====================================================================
// Nodemailer transporter — Gmail SMTP.
// EMAIL_USER / EMAIL_PASS must be a Gmail address + a 16-character
// "App Password" (Google Account → Security → App Passwords). Regular
// account passwords will not work if 2FA is enabled, and using them
// is not recommended even if it does.
// =====================================================================
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify the SMTP connection once at startup so misconfiguration shows
// up in the logs immediately instead of on the first user's OTP request.
transporter.verify((err) => {
  if (err) {
    console.error("[mail] SMTP transporter verification failed:", err.message);
  } else {
    console.log("[mail] SMTP transporter ready.");
  }
});

export default transporter;
