const express = require("express");

const {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

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
 * /api/customers:
 *   post:
 *     summary: Create a new customer
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nimal Perera
 *               phone:
 *                 type: string
 *                 example: "0771234567"
 *               email:
 *                 type: string
 *                 example: nimal@gmail.com
 *               address:
 *                 type: string
 *                 example: Colombo
 *     responses:
 *       201:
 *         description: Customer created successfully
 *       400:
 *         description: Customer name and phone number are required
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 */

// Admin can create customers
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Customer name is required"),

    body("phone")
      .trim()
      .matches(/^[0-9]{10}$/)
      .withMessage("Phone number must contain exactly 10 digits"),

    body("email")
      .optional({ checkFalsy: true })
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail(),

    body("address")
      .optional({ checkFalsy: true })
      .trim(),
  ],
  validateRequest,
  createCustomer
);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer list retrieved successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Access denied
 */

// Admin and technician can view all customers
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "technician"),
  getAllCustomers
);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get a customer by ID
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer retrieved successfully
 *       404:
 *         description: Customer not found
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Access denied
 */

// Admin and technician can view one customer
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "technician"),
  getCustomerById
);

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Update a customer
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Customer ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nimal Perera
 *               phone:
 *                 type: string
 *                 example: "0719876543"
 *               email:
 *                 type: string
 *                 example: nimalperera@gmail.com
 *               address:
 *                 type: string
 *                 example: Kandy
 *     responses:
 *       200:
 *         description: Customer updated successfully
 *       400:
 *         description: Invalid customer details
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Customer not found
 */

// Admin can update a customer
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Customer name is required"),

    body("phone")
      .trim()
      .matches(/^[0-9]{10}$/)
      .withMessage("Phone number must contain exactly 10 digits"),

    body("email")
      .optional({ checkFalsy: true })
      .trim()
      .isEmail()
      .withMessage("Enter a valid email address")
      .normalizeEmail(),

    body("address")
      .optional({ checkFalsy: true })
      .trim(),
  ],
  validateRequest,
  updateCustomer
);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Delete a customer
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Customer ID
 *     responses:
 *       200:
 *         description: Customer deleted successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Customer not found
 */

// Admin can delete a customer
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deleteCustomer
);

module.exports = router;