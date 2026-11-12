const logger = require("../config/logger");

// Handle routes that do not exist
const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Handle unexpected server errors
const errorHandler = (error, req, res, next) => {
  logger.error(error.message, {
    method: req.method,
    url: req.originalUrl,
    stack: error.stack,
  });

  if (res.headersSent) {
    return next(error);
  }

  return res.status(error.status || 500).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error.message || "Internal server error",
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};