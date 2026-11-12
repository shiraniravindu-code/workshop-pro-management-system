const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const pool = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const jobRoutes = require("./routes/jobRoutes");
const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const logger = require("./config/logger");
const {
  notFoundHandler,
  errorHandler,
} = require("./middleware/errorMiddleware");

// Middleware
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...(process.env.FRONTEND_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean),
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("CORS origin is not allowed"));
  },
}));
app.use(express.json());
app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      },
    },
  })
);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
// These routes must appear before the 404 handler.
app.get("/", (req, res) => {
  res.json({ message: "Workshop Job Tracker API is running" });
});
app.get("/api/health", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ api: "running", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
// Export the Express app for API tests without opening a port on import.
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;