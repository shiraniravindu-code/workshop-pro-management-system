const bcrypt = require('bcrypt');
const pool = require('../config/db');

const isValidId = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

// Administrative directory: never return password hashes or JWT secrets.
const getAllAdmins = async (_req, res) => {
  try {
    const [admins] = await pool.execute(
      `SELECT user_id, name, email, is_active, created_at
       FROM users WHERE role = 'admin' ORDER BY user_id DESC`
    );
    return res.json({ admins, total: admins.length });
  } catch (error) {
    console.error('List admins error:', error.message);
    return res.status(500).json({ message: 'Unable to load administrators' });
  }
};

// Only an authenticated admin may create another admin. Role is fixed server-side.
const createAdmin = async (req, res) => {
  const name = req.body.name.trim();
  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password;
  try {
    const [existing] = await pool.execute(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1', [email]
    );
    if (existing.length) return res.status(409).json({ message: 'This email is already registered' });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role, is_active)
       VALUES (?, ?, ?, 'admin', 1)`,
      [name, email, hash]
    );
    return res.status(201).json({
      message: 'Administrator created successfully',
      admin: { user_id: result.insertId, name, email, role: 'admin', is_active: true },
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This email is already registered' });
    }
    console.error('Create admin error:', error.message);
    return res.status(500).json({ message: 'Unable to create administrator' });
  }
};

// Lock admin rows in a transaction so concurrent requests cannot deactivate
// the final active administrator. Own account deactivation is never allowed.
const setAdminStatus = async (req, res) => {
  const { is_active } = req.body;
  if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid admin ID' });
  if (typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active must be true or false' });
  const targetId = Number(req.params.id);
  if (!is_active && targetId === Number(req.user.userId)) {
    return res.status(403).json({ message: 'You cannot deactivate your own administrator account' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [admins] = await connection.execute(
      `SELECT user_id, is_active FROM users WHERE role = 'admin' ORDER BY user_id FOR UPDATE`
    );
    const target = admins.find(a => Number(a.user_id) === targetId);
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ message: 'Administrator not found' });
    }
    if (!is_active && admins.filter(a => Number(a.is_active) === 1).length <= 1) {
      await connection.rollback();
      return res.status(409).json({ message: 'At least one active administrator is required' });
    }
    await connection.execute(
      `UPDATE users SET is_active = ? WHERE user_id = ? AND role = 'admin'`,
      [is_active ? 1 : 0, targetId]
    );
    await connection.commit();
    return res.json({ message: is_active ? 'Administrator activated' : 'Administrator deactivated' });
  } catch (error) {
    if (connection) {
      try { await connection.rollback(); } catch (rollbackError) { console.error('Rollback failed:', rollbackError.message); }
    }
    console.error('Update admin status error:', error.message);
    return res.status(500).json({ message: 'Unable to update administrator' });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { getAllAdmins, createAdmin, setAdminStatus };
