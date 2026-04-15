export function errorHandler(error, _req, res, _next) {
  res.status(error.statusCode || 500).json({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.message || "Unhandled server error",
      retryable: Boolean(error.retryable)
    }
  });
}
