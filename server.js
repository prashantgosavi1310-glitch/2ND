// =====================================================================
// MessMate backend — entry point.
// =====================================================================
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import messRoutes from "./routes/mess.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// ---------------------------------------------------------------------
// Security & core middleware
// ---------------------------------------------------------------------
app.set("trust proxy", 1); // Railway sits behind a proxy — needed for correct req.ip / rate limiting

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

// Morgan logs request lines only (method, path, status, timing) — never
// request bodies — so passwords and OTPs are never written to logs.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// Global rate limit — a broad safety net; individual auth routes apply
// their own stricter limiters on top of this.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
  })
);

// Serve uploaded files (photos, college IDs) as static assets.
app.use("/uploads", express.static(path.resolve("uploads")));

// ---------------------------------------------------------------------
// Health check — useful for Railway's deploy health checks
// ---------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "MessMate API is running." });
});

// ---------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/mess", messRoutes);

// ---------------------------------------------------------------------
// 404 + centralized error handler (must be last)
// ---------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[server] MessMate API listening on port ${PORT} (${process.env.NODE_ENV || "development"})`);
});

export default app;
