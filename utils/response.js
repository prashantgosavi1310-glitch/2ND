// =====================================================================
// Standardized JSON response shape used across every controller so the
// frontend can rely on one consistent envelope:
//   success responses -> { success: true,  message, data }
//   error responses    -> { success: false, message, errors }
// =====================================================================

export function successResponse(res, statusCode, message, data = null) {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  return res.status(statusCode).json(body);
}

export function errorResponse(res, statusCode, message, errors = null) {
  const body = { success: false, message };
  if (errors !== null) body.errors = errors;
  return res.status(statusCode).json(body);
}
