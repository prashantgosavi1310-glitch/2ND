// =====================================================================
// Auth middleware — verifies the JWT and gates routes by role.
// Accepts the token from either the httpOnly cookie set at login
// (preferred) or an `Authorization: Bearer <token>` header, so the
// frontend can use either approach without a backend change.
// =====================================================================
import { verifyAccessToken } from "../services/jwt.service.js";
import { errorResponse } from "../utils/response.js";

function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
}

export function authenticateJWT(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return errorResponse(res, 401, "Authentication required.");
  }
  try {
    req.user = verifyAccessToken(token); // { id, role, email }
    return next();
  } catch (err) {
    return errorResponse(res, 401, "Invalid or expired session. Please log in again.");
  }
}

function authorizeRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, "Authentication required.");
    }
    if (req.user.role !== role) {
      return errorResponse(res, 403, "You do not have permission to perform this action.");
    }
    return next();
  };
}

export const authorizeUser = authorizeRole("user");
export const authorizeMessOwner = authorizeRole("mess");
export const authorizeAdmin = authorizeRole("admin");
