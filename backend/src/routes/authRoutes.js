const express = require("express");

const {
  register,
  login,
} = require("../controllers/authController");

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
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Kasun Perera
 *               email:
 *                 type: string
 *                 example: kasun@gmail.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid registration details
 *       409:
 *         description: Email is already registered
 */

// Register user
router.post(
  "/register",
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required"),

    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail(),

    body("password")
      .isLength({ min: 6 })
      .withMessage(
        "Password must contain at least 6 characters"
      ),
  ],
  validateRequest,
  register
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login as an admin or technician
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@gmail.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid email or password
 */

// Login user
router.post(
  "/login",
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail(),

    body("password")
      .notEmpty()
      .withMessage("Password is required"),
  ],
  validateRequest,
  login
);

// Protected profile route
router.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: "Protected route accessed successfully",
    user: req.user,
  });
});

// Admin-only protected route
router.get(
  "/admin-only",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      message: "Admin access granted",
      user: req.user,
    });
  }
);

module.exports = router;