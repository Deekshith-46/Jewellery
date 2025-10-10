const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;

function sign(user) {
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

module.exports = { sign };
