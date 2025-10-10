const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/user/User');

exports.loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Admin credentials required' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const payload = { userId: user._id, role: user.role };
    const admin_token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ admin_token, user: { id: user._id, email: user.email, role: user.role } });
  } catch (err) { next(err); }
};

