const pool = require("../config/db");

// Create a new vehicle
const createVehicle = async (req, res) => {
  const {
    customer_id,
    vehicle_number,
    vehicle_type,
    brand,
    model,
    manufacture_year,
  } = req.body;

  if (!customer_id || !vehicle_number || !vehicle_type) {
    return res.status(400).json({
      message:
        "Customer, vehicle number and vehicle type are required",
    });
  }

  try {
    const [customers] = await pool.execute(
      "SELECT customer_id FROM customers WHERE customer_id = ?",
      [customer_id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const [existingVehicles] = await pool.execute(
      "SELECT vehicle_id FROM vehicles WHERE vehicle_number = ?",
      [vehicle_number.trim().toUpperCase()]
    );

    if (existingVehicles.length > 0) {
      return res.status(409).json({
        message: "Vehicle number is already registered",
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO vehicles
       (customer_id, vehicle_number, vehicle_type, brand, model, manufacture_year)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        customer_id,
        vehicle_number.trim().toUpperCase(),
        vehicle_type.trim(),
        brand ? brand.trim() : null,
        model ? model.trim() : null,
        manufacture_year || null,
      ]
    );

    return res.status(201).json({
      message: "Vehicle created successfully",
      vehicle: {
        vehicleId: result.insertId,
        customer_id,
        vehicle_number: vehicle_number.trim().toUpperCase(),
        vehicle_type: vehicle_type.trim(),
        brand: brand ? brand.trim() : null,
        model: model ? model.trim() : null,
        manufacture_year: manufacture_year || null,
      },
    });
  } catch (error) {
    console.error("Create vehicle error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Get all vehicles
const getAllVehicles = async (req, res) => {
  try {
    const [vehicles] = await pool.execute(
      `SELECT
         v.vehicle_id,
         v.customer_id,
         c.name AS customer_name,
         v.vehicle_number,
         v.vehicle_type,
         v.brand,
         v.model,
         v.manufacture_year,
         v.created_at
       FROM vehicles v
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       ORDER BY v.vehicle_id DESC`
    );

    return res.json({
      total: vehicles.length,
      vehicles,
    });
  } catch (error) {
    console.error("Get vehicles error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Get one vehicle by ID
const getVehicleById = async (req, res) => {
  const { id } = req.params;

  try {
    const [vehicles] = await pool.execute(
      `SELECT
         v.vehicle_id,
         v.customer_id,
         c.name AS customer_name,
         v.vehicle_number,
         v.vehicle_type,
         v.brand,
         v.model,
         v.manufacture_year,
         v.created_at
       FROM vehicles v
       INNER JOIN customers c
         ON v.customer_id = c.customer_id
       WHERE v.vehicle_id = ?`,
      [id]
    );

    if (vehicles.length === 0) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    return res.json({
      vehicle: vehicles[0],
    });
  } catch (error) {
    console.error("Get vehicle error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Update a vehicle
const updateVehicle = async (req, res) => {
  const { id } = req.params;

  const {
    customer_id,
    vehicle_number,
    vehicle_type,
    brand,
    model,
    manufacture_year,
  } = req.body;

  if (!customer_id || !vehicle_number || !vehicle_type) {
    return res.status(400).json({
      message:
        "Customer, vehicle number and vehicle type are required",
    });
  }

  try {
    const [customers] = await pool.execute(
      "SELECT customer_id FROM customers WHERE customer_id = ?",
      [customer_id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    const [duplicateVehicles] = await pool.execute(
      `SELECT vehicle_id
       FROM vehicles
       WHERE vehicle_number = ?
       AND vehicle_id != ?`,
      [vehicle_number.trim().toUpperCase(), id]
    );

    if (duplicateVehicles.length > 0) {
      return res.status(409).json({
        message: "Vehicle number is already registered",
      });
    }

    const [result] = await pool.execute(
      `UPDATE vehicles
       SET customer_id = ?,
           vehicle_number = ?,
           vehicle_type = ?,
           brand = ?,
           model = ?,
           manufacture_year = ?
       WHERE vehicle_id = ?`,
      [
        customer_id,
        vehicle_number.trim().toUpperCase(),
        vehicle_type.trim(),
        brand ? brand.trim() : null,
        model ? model.trim() : null,
        manufacture_year || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Vehicle not found",
      });
    }

    return res.json({
      message: "Vehicle updated successfully",
    });
  } catch (error) {
    console.error("Update vehicle error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Delete a vehicle only when it has no related records.
// FOR UPDATE holds the parent lock while checking children and deleting,
// preventing a concurrent child insert from racing with this check.
const deleteVehicle = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [parents] = await connection.execute(
      "SELECT vehicle_id FROM vehicles WHERE vehicle_id = ? FOR UPDATE",
      [id]
    );
    if (parents.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Vehicle not found" });
    }

    const [children] = await connection.execute(
      "SELECT 1 FROM jobs WHERE vehicle_id = ? LIMIT 1",
      [id]
    );
    if (children.length) {
      await connection.rollback();
      return res.status(409).json({
        message: "Cannot delete vehicle: related jobs must be removed first to preserve service history"
      });
    }

    await connection.execute("DELETE FROM vehicles WHERE vehicle_id = ?", [id]);
    await connection.commit();
    return res.json({ message: "Vehicle deleted successfully" });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Delete vehicle rollback error:", rollbackError.message);
      }
    }
    console.error("Delete vehicle error:", error.message);
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ message: "Cannot delete vehicle while related records exist" });
    }
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
};