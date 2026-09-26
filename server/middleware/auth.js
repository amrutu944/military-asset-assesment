const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { BASES } = require('../config/constants');

const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token is invalid or expired' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized to perform this action`,
    });
  }
  next();
};

// The base a request is scoped to. Non-admins are always pinned to their own
// base (a ?base= override is ignored); admins may optionally narrow with ?base=.
// Returns null when the admin is viewing all bases.
const scopedBase = (req) => {
  if (req.user.role !== 'admin') return req.user.base;
  return BASES.includes(req.query.base) ? req.query.base : null;
};

const canAccessBase = (user, base) => user.role === 'admin' || user.base === base;

module.exports = { protect, authorize, scopedBase, canAccessBase };
