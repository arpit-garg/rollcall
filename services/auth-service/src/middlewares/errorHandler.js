export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || 500;

  res.status(status).json({
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: error.message || "Unhandled server error",
      retryable: Boolean(error.retryable)
    }
  });
}
