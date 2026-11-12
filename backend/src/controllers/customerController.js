const pool = require("../config/db");

// Create a new customer
const createCustomer = async (req, res) => {
  const { name, phone, email, address } = req.body;

  if (!name || !phone) {
    return res.status(400).json({
      message: "Customer name and phone number are required",
    });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO customers (name, phone, email, address)
       VALUES (?, ?, ?, ?)`,
      [
        name.trim(),
        phone.trim(),
        email ? email.trim().toLowerCase() : null,
        address ? address.trim() : null,
      ]
    );

    return res.status(201).json({
      message: "Customer created successfully",
      customer: {
        customerId: result.insertId,
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim().toLowerCase() : null,
        address: address ? address.trim() : null,
      },
    });
  } catch (error) {
    console.error("Create customer error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Get all customers
const getAllCustomers = async (req, res) => {
  try {
    const [customers] = await pool.execute(
      `SELECT customer_id, name, phone, email, address,
              created_at, updated_at
       FROM customers
       ORDER BY customer_id DESC`
    );

    return res.json({
      total: customers.length,
      customers,
    });
  } catch (error) {
    console.error("Get customers error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Get one customer by ID
const getCustomerById = async (req, res) => {
  const { id } = req.params;

  try {
    const [customers] = await pool.execute(
      `SELECT customer_id, name, phone, email, address,
              created_at, updated_at
       FROM customers
       WHERE customer_id = ?`,
      [id]
    );

    if (customers.length === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    return res.json({
      customer: customers[0],
    });
  } catch (error) {
    console.error("Get customer error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Update a customer
const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address } = req.body;

  if (!name || !phone) {
    return res.status(400).json({
      message: "Customer name and phone number are required",
    });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE customers
       SET name = ?, phone = ?, email = ?, address = ?
       WHERE customer_id = ?`,
      [
        name.trim(),
        phone.trim(),
        email ? email.trim().toLowerCase() : null,
        address ? address.trim() : null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Customer not found",
      });
    }

    return res.json({
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.error("Update customer error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Delete a customer only when it has no related records.
// FOR UPDATE holds the parent lock while checking children and deleting,
// preventing a concurrent child insert from racing with this check.
const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [parents] = await connection.execute(
      "SELECT customer_id FROM customers WHERE customer_id = ? FOR UPDATE",
      [id]
    );
    if (parents.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Customer not found" });
    }

    const [children] = await connection.execute(
      "SELECT 1 FROM vehicles WHERE customer_id = ? LIMIT 1",
      [id]
    );
    if (children.length) {
      await connection.rollback();
      return res.status(409).json({
        message: "Cannot delete customer: related vehicles must be removed first to preserve service history"
      });
    }

    await connection.execute("DELETE FROM customers WHERE customer_id = ?", [id]);
    await connection.commit();
    return res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) {
        console.error("Delete customer rollback error:", rollbackError.message);
      }
    }
    console.error("Delete customer error:", error.message);
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({ message: "Cannot delete customer while related records exist" });
    }
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};