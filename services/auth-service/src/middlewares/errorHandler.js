export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || 500;
  const isServerError = status >= 500;

  res.status(status).json({
    error: {
      code: isServerError ? "INTERNAL_ERROR" : error.code || "INTERNAL_ERROR",
      message: isServerError ? "Internal server error" : error.message || "Unhandled server error",
      retryable: isServerError ? false : Boolean(error.retryable)
    }
  });
}
