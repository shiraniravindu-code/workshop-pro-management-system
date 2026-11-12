const express = require("express");

const {
  getAllTechnicians,
  updateTechnicianStatus,
} = require("../controllers/userController");

const {
  authenticateToken,
} = require("../middleware/authMiddleware");

const {
  authorizeRoles,
} = require("../middleware/roleMiddleware");

const { register } = require("../controllers/authController");
const { body } = require("express-validator");
const { validateRequest } = require("../middleware/validationMiddleware");
const router = express.Router();

// New technicians are created exclusively by an authenticated admin.
router.post(
  "/technicians",
  authenticateToken,
  authorizeRoles("admin"),
  [
    body("name").trim().isLength({ min: 2, max: 100 }).withMessage("Name must be 2–100 characters"),
    body("email").trim().isEmail().withMessage("Enter a valid email address").normalizeEmail(),
    body("password").isLength({ min: 6, max: 72 }).withMessage("Password must be at least 6 characters"),
  ],
  validateRequest,
  register
);


/**
 * @swagger
 * /api/users/technicians:
 *   get:
 *     summary: Get all technicians
 *     tags:
 *       - Technicians
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Technician list retrieved successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 */

// Admin can view all technicians
router.get(
  "/technicians",
  authenticateToken,
  authorizeRoles("admin"),
  getAllTechnicians
);

/**
 * @swagger
 * /api/users/technicians/{id}/status:
 *   patch:
 *     summary: Activate or deactivate a technician
 *     tags:
 *       - Technicians
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Technician user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Technician status updated successfully
 *       400:
 *         description: is_active must be true or false
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Technician not found
 */

// Admin can activate or deactivate a technician
router.patch(
  "/technicians/:id/status",
  authenticateToken,
  authorizeRoles("admin"),
  updateTechnicianStatus
);

// Admin-only administrator management. No public registration or role changes.
const { getAllAdmins, createAdmin, setAdminStatus } = require('../controllers/adminController');

router.get('/admins', authenticateToken, authorizeRoles('admin'), getAllAdmins);

router.post('/admins',
  authenticateToken,
  authorizeRoles('admin'),
  [
    body('name').isString().trim().isLength({ min: 2, max: 100 })
      .withMessage('Name must contain 2–100 characters'),
    body('email').isString().trim().isEmail().withMessage('Enter a valid email address')
      .normalizeEmail(),
    body('password').isString().isLength({ min: 10, max: 72 })
      .withMessage('Password must contain 10–72 characters')
      .matches(/^(?=.*[A-Za-z])(?=.*[0-9])/)
      .withMessage('Password must contain at least one letter and one number'),
  ],
  validateRequest,
  createAdmin
);

router.patch('/admins/:id/status',
  authenticateToken,
  authorizeRoles('admin'),
  setAdminStatus
);

module.exports = router;