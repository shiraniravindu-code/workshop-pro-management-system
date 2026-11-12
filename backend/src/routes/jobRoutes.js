const express = require("express");

const {
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  updateJobStatus,
  deleteJob,
} = require("../controllers/jobController");

const {
  authenticateToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const router = express.Router();

const { body } = require("express-validator");

const {
  validateRequest,
} = require("../middleware/validationMiddleware");

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Create a new repair job
 *     tags:
 *       - Jobs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicle_id
 *               - problem_description
 *               - received_date
 *             properties:
 *               vehicle_id:
 *                 type: integer
 *                 example: 1
 *               technician_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 2
 *               problem_description:
 *                 type: string
 *                 example: Engine overheating and unusual noise
 *               received_date:
 *                 type: string
 *                 format: date
 *                 example: 2026-07-20
 *               expected_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: 2026-07-25
 *               estimated_cost:
 *                 type: number
 *                 example: 25000
 *     responses:
 *       201:
 *         description: Repair job created successfully
 *       400:
 *         description: Required job details are missing
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Vehicle or technician not found
 */

// Admin can create repair jobs
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  [
    body("vehicle_id")
      .isInt({ min: 1 })
      .withMessage("Enter a valid vehicle ID")
      .toInt(),

    body("technician_id")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage("Enter a valid technician ID")
      .toInt(),

    body("problem_description")
      .trim()
      .notEmpty()
      .withMessage("Problem description is required"),

    body("received_date")
      .isISO8601({ strict: true })
      .withMessage("Received date must use YYYY-MM-DD format"),

    body("expected_date")
      .optional({ nullable: true })
      .isISO8601({ strict: true })
      .withMessage("Expected date must use YYYY-MM-DD format"),

    body("estimated_cost")
      .optional({ nullable: true })
      .isFloat({ min: 0, max: 99999999.99 })
      .withMessage("Estimated cost must be between 0 and 99,999,999.99")
      .toFloat(),
  ],
  validateRequest,
  createJob
);

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Get all repair jobs
 *     tags:
 *       - Jobs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Repair job list retrieved successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Access denied
 */

// Admin and technician can view repair jobs
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "technician"),
  getAllJobs
);

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get a repair job by ID
 *     tags:
 *       - Jobs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Repair job ID
 *     responses:
 *       200:
 *         description: Repair job retrieved successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Repair job not found
 */

// Admin and technician can view one repair job
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "technician"),
  getJobById
);

/**
 * @swagger
 * /api/jobs/{id}:
 *   put:
 *     summary: Update and assign a repair job
 *     tags:
 *       - Jobs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Repair job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicle_id
 *               - problem_description
 *               - status
 *               - received_date
 *             properties:
 *               vehicle_id:
 *                 type: integer
 *                 example: 1
 *               technician_id:
 *                 type: integer
 *                 nullable: true
 *                 example: 2
 *               problem_description:
 *                 type: string
 *                 example: Engine overheating and unusual noise
 *               repair_notes:
 *                 type: string
 *                 nullable: true
 *                 example: Initial inspection completed
 *               status:
 *                 type: string
 *                 enum:
 *                   - Pending
 *                   - Assigned
 *                   - In Progress
 *                   - Completed
 *                   - Cancelled
 *                 example: Assigned
 *               received_date:
 *                 type: string
 *                 format: date
 *                 example: 2026-07-20
 *               expected_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *                 example: 2026-07-25
 *               completed_date:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               estimated_cost:
 *                 type: number
 *                 example: 25000
 *               final_cost:
 *                 type: number
 *                 example: 0
 *     responses:
 *       200:
 *         description: Repair job updated successfully
 *       400:
 *         description: Invalid repair job details
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Repair job, vehicle or technician not found
 */

// Admin can update and assign repair jobs
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  [
    body("vehicle_id")
      .isInt({ min: 1 })
      .withMessage("Enter a valid vehicle ID")
      .toInt(),

    body("technician_id")
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage("Enter a valid technician ID")
      .toInt(),

    body("problem_description")
      .trim()
      .notEmpty()
      .withMessage("Problem description is required"),

    body("repair_notes")
      .optional({ nullable: true })
      .trim(),

    body("status")
      .isIn([
        "Pending",
        "Assigned",
        "In Progress",
        "Completed",
        "Cancelled",
      ])
      .withMessage("Enter a valid job status"),

    body("received_date")
      .isISO8601({ strict: true })
      .withMessage("Received date must use YYYY-MM-DD format"),

    body("expected_date")
      .optional({ nullable: true })
      .isISO8601({ strict: true })
      .withMessage("Expected date must use YYYY-MM-DD format"),

    body("completed_date")
      .optional({ nullable: true })
      .isISO8601({ strict: true })
      .withMessage("Completed date must use YYYY-MM-DD format"),

    body("estimated_cost")
      .optional({ nullable: true })
      .isFloat({ min: 0, max: 99999999.99 })
      .withMessage("Estimated cost must be between 0 and 99,999,999.99")
      .toFloat(),

    body("final_cost")
      .optional({ nullable: true })
      .isFloat({ min: 0, max: 99999999.99 })
      .withMessage("Final cost must be between 0 and 99,999,999.99")
      .toFloat(),
  ],
  validateRequest,
  updateJob
);

/**
 * @swagger
 * /api/jobs/{id}/status:
 *   patch:
 *     summary: Update the status of a repair job
 *     tags:
 *       - Jobs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Repair job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - Pending
 *                   - Assigned
 *                   - In Progress
 *                   - Completed
 *                   - Cancelled
 *                 example: In Progress
 *               repair_notes:
 *                 type: string
 *                 example: Engine cooling system inspection started
 *               final_cost:
 *                 type: number
 *                 nullable: true
 *                 example: 27500
 *     responses:
 *       200:
 *         description: Job status updated successfully
 *       400:
 *         description: Invalid job status
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Access denied or job is not assigned to technician
 *       404:
 *         description: Repair job not found
 */

// Admin and assigned technician can update job status
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRoles("admin", "technician"),
  [
    body("status")
      .isIn([
        "Pending",
        "Assigned",
        "In Progress",
        "Completed",
        "Cancelled",
      ])
      .withMessage("Enter a valid job status"),

    body("repair_notes")
      .optional({ nullable: true })
      .trim(),

    body("final_cost")
      .optional({ nullable: true })
      .isFloat({ min: 0, max: 99999999.99 })
      .withMessage("Final cost must be between 0 and 99,999,999.99")
      .toFloat(),
  ],
  validateRequest,
  updateJobStatus
);

/**
 * @swagger
 * /api/jobs/{id}:
 *   delete:
 *     summary: Delete a repair job
 *     tags:
 *       - Jobs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Repair job ID
 *     responses:
 *       200:
 *         description: Repair job deleted successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Repair job not found
 */

// Admin can delete a repair job
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deleteJob
);

// Read persisted history. Technicians may only read their assigned job.
router.get('/:id/history', authenticateToken, authorizeRoles('admin', 'technician'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid job ID' });
  try {
    const pool = require('../config/db');
    const [jobs] = await pool.execute('SELECT job_id, technician_id FROM jobs WHERE job_id = ?', [id]);
    if (!jobs.length) return res.status(404).json({ message: 'Repair job not found' });
    if (req.user.role === 'technician' && Number(jobs[0].technician_id) !== Number(req.user.userId)) {
      return res.status(403).json({ message: 'This job is not assigned to you' });
    }
    const [history] = await pool.execute(
      `SELECT h.*, u.name AS updated_by_name FROM job_status_history h
       LEFT JOIN users u ON u.user_id = h.updated_by
       WHERE h.job_id = ? ORDER BY h.updated_at, h.history_id`, [id]);
    return res.json({ history });
  } catch (error) { next(error); }
});

module.exports = router;
