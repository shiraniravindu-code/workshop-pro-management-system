const pool = require("../config/db");

// Get all technicians
const getAllTechnicians = async (req, res) => {
  try {
    const [technicians] = await pool.execute(
      `SELECT
         user_id,
         name,
         email,
         role,
         is_active,
         created_at,
         updated_at
       FROM users
       WHERE role = 'technician'
       ORDER BY user_id DESC`
    );

    return res.json({
      total: technicians.length,
      technicians,
    });
  } catch (error) {
    console.error("Get technicians error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Activate or deactivate a technician
const updateTechnicianStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== "boolean") {
    return res.status(400).json({
      message: "is_active must be true or false",
    });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE users
       SET is_active = ?
       WHERE user_id = ?
       AND role = 'technician'`,
      [is_active, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Technician not found",
      });
    }

    return res.json({
      message: is_active
        ? "Technician activated successfully"
        : "Technician deactivated successfully",
    });
  } catch (error) {
    console.error(
      "Update technician status error:",
      error.message
    );

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAllTechnicians,
  updateTechnicianStatus,
};