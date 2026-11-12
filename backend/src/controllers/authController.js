const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      message: "Name, email and password are required",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: "Password must contain at least 6 characters",
    });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    const [existingUsers] = await pool.execute(
      "SELECT user_id FROM users WHERE email = ?",
      [cleanEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: "Email is already registered",
      });
    }

    // New technicians can ONLY be created by an authenticated administrator.
    // First-admin bootstrap is off by default and must be explicitly enabled
    // for a fresh, empty database, then disabled immediately afterwards.
    const adminCreatingTechnician = req.user?.role === "admin";
    let role = "technician";
    if (!adminCreatingTechnician) {
      if (process.env.ALLOW_INITIAL_ADMIN_REGISTRATION !== "true") {
        return res.status(403).json({ message: "Public registration is disabled. Contact an administrator." });
      }
      const [counts] = await pool.execute("SELECT COUNT(*) AS total FROM users");
      if (Number(counts[0].total) !== 0) {
        return res.status(403).json({ message: "Initial administrator has already been created." });
      }
      role = "admin";
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), cleanEmail, hashedPassword, role]
    );

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        userId: result.insertId,
        name: name.trim(),
        email: cleanEmail,
        role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required",
    });
  }

  try {
    const [users] = await pool.execute(
      `SELECT user_id, name, email, password, role, is_active
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: "This account is inactive",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.user_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      }
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  register,
  login,
};
