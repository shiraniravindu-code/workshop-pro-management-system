const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Verify token AND current database status on every protected request.
const authenticateToken = async (req, res, next) => {
  const authorizationHeader = req.headers.authorization;
  const token = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication token is required" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ message: "Invalid or expired token" });
  }

  const id = Number(decoded.userId);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
  try {
    const [users] = await pool.execute(
      "SELECT user_id, role, is_active FROM users WHERE user_id = ? LIMIT 1", [id]
    );
    if (!users.length || !Number(users[0].is_active)) {
      return res.status(403).json({ message: "This account is inactive or unavailable" });
    }
    req.user = { userId: id, role: users[0].role };
    next();
  } catch (error) {
    next(error);
  }
};
module.exports = { authenticateToken };
