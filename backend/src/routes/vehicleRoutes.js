const express = require("express");

const {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} = require("../controllers/vehicleController");

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
 * /api/vehicles:
 *   post:
 *     summary: Create a new vehicle
 *     tags:
 *       - Vehicles
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - vehicle_number
 *               - vehicle_type
 *             properties:
 *               customer_id:
 *                 type: integer
 *                 example: 1
 *               vehicle_number:
 *                 type: string
 *                 example: CAB-1234
 *               vehicle_type:
 *                 type: string
 *                 example: Car
 *               brand:
 *                 type: string
 *                 example: Toyota
 *               model:
 *                 type: string
 *                 example: Corolla
 *               manufacture_year:
 *                 type: integer
 *                 example: 2018
 *     responses:
 *       201:
 *         description: Vehicle created successfully
 *       400:
 *         description: Required vehicle details are missing
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Customer not found
 *       409:
 *         description: Vehicle number is already registered
 */

// Admin can create vehicles
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  [
    body("customer_id")
      .isInt({ min: 1 })
      .withMessage("Enter a valid customer ID")
      .toInt(),

    body("vehicle_number")
      .trim()
      .notEmpty()
      .withMessage("Vehicle number is required")
      .isLength({ max: 30 })
      .withMessage("Vehicle number is too long"),

    body("vehicle_type")
      .trim()
      .notEmpty()
      .withMessage("Vehicle type is required"),

    body("brand")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 })
      .withMessage("Brand must not exceed 50 characters"),

    body("model")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 })
      .withMessage("Model must not exceed 50 characters"),

    body("manufacture_year")
      .optional({ checkFalsy: true })
      .isInt({
        min: 1900,
        max: new Date().getFullYear() + 1,
      })
      .withMessage("Enter a valid manufacture year")
      .toInt(),
  ],
  validateRequest,
  createVehicle
);

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Get all vehicles
 *     tags:
 *       - Vehicles
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vehicle list retrieved successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Access denied
 */

// Admin and technician can view vehicles
router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin", "technician"),
  getAllVehicles
);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Get a vehicle by ID
 *     tags:
 *       - Vehicles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vehicle ID
 *     responses:
 *       200:
 *         description: Vehicle retrieved successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Vehicle not found
 */

// Admin and technician can view one vehicle
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("admin", "technician"),
  getVehicleById
);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   put:
 *     summary: Update a vehicle
 *     tags:
 *       - Vehicles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vehicle ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - vehicle_number
 *               - vehicle_type
 *             properties:
 *               customer_id:
 *                 type: integer
 *                 example: 1
 *               vehicle_number:
 *                 type: string
 *                 example: CAB-1234
 *               vehicle_type:
 *                 type: string
 *                 example: Car
 *               brand:
 *                 type: string
 *                 example: Toyota
 *               model:
 *                 type: string
 *                 example: Corolla Axio
 *               manufacture_year:
 *                 type: integer
 *                 example: 2019
 *     responses:
 *       200:
 *         description: Vehicle updated successfully
 *       400:
 *         description: Required vehicle details are missing
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Vehicle or customer not found
 *       409:
 *         description: Vehicle number is already registered
 */

// Admin can update a vehicle
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  [
    body("customer_id")
      .isInt({ min: 1 })
      .withMessage("Enter a valid customer ID")
      .toInt(),

    body("vehicle_number")
      .trim()
      .notEmpty()
      .withMessage("Vehicle number is required")
      .isLength({ max: 30 })
      .withMessage("Vehicle number is too long"),

    body("vehicle_type")
      .trim()
      .notEmpty()
      .withMessage("Vehicle type is required"),

    body("brand")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 })
      .withMessage("Brand must not exceed 50 characters"),

    body("model")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 })
      .withMessage("Model must not exceed 50 characters"),

    body("manufacture_year")
      .optional({ checkFalsy: true })
      .isInt({
        min: 1900,
        max: new Date().getFullYear() + 1,
      })
      .withMessage("Enter a valid manufacture year")
      .toInt(),
  ],
  validateRequest,
  updateVehicle
);

/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Delete a vehicle
 *     tags:
 *       - Vehicles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Vehicle ID
 *     responses:
 *       200:
 *         description: Vehicle deleted successfully
 *       401:
 *         description: Authentication token is required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Vehicle not found
 */

// Admin can delete a vehicle
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("admin"),
  deleteVehicle
);

module.exports = router;