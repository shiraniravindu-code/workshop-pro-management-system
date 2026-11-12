const express = require("express");

const {
  getDailyReport,
  getMonthlyReport,
  exportMonthlyReportCsv,
  exportMonthlyReportPdf,
} = require("../controllers/reportController");

const {
  authenticateToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/reports/daily:
 *   get:
 *     summary: Get a daily repair job report
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         description: Report date in YYYY-MM-DD format
 *         example: 2026-07-20
 *     responses:
 *       200:
 *         description: Daily report retrieved successfully
 *       400:
 *         description: Invalid date format
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 */

// Admin can view daily reports
router.get(
  "/daily",
  authenticateToken,
  authorizeRoles("admin"),
  getDailyReport
);

/**
 * @swagger
 * /api/reports/monthly:
 *   get:
 *     summary: Get a monthly repair job report
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: Report month in YYYY-MM format
 *         example: 2026-07
 *     responses:
 *       200:
 *         description: Monthly report retrieved successfully
 *       400:
 *         description: Invalid month format
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 */

// Admin can view monthly reports
router.get(
  "/monthly",
  authenticateToken,
  authorizeRoles("admin"),
  getMonthlyReport
);

/**
 * @swagger
 * /api/reports/monthly/csv:
 *   get:
 *     summary: Export a monthly repair job report as CSV
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: Report month in YYYY-MM format
 *         example: 2026-07
 *     responses:
 *       200:
 *         description: Monthly CSV report generated successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid month format
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 */

// Admin can export monthly report as CSV
router.get(
  "/monthly/csv",
  authenticateToken,
  authorizeRoles("admin"),
  exportMonthlyReportCsv
);

/**
 * @swagger
 * /api/reports/monthly/pdf:
 *   get:
 *     summary: Export a monthly repair job report as PDF
 *     tags:
 *       - Reports
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         description: Report month in YYYY-MM format
 *         example: 2026-07
 *     responses:
 *       200:
 *         description: Monthly PDF report generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid month format
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 */

// Admin can export monthly report as PDF
router.get(
  "/monthly/pdf",
  authenticateToken,
  authorizeRoles("admin"),
  exportMonthlyReportPdf
);

module.exports = router;