const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/http');

const generateToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, base: user.base }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1d',
  });

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  base: user.base,
});

// Brute-force protection on the only unauthenticated write endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes' },
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, 'Please provide email and password');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  const valid = user && user.isActive && (await user.matchPassword(password));

  if (!valid) {
    res.locals.audit = { action: 'LOGIN_FAILED', entity: 'User', summary: `Failed login for ${email}` };
    throw new HttpError(401, 'Invalid email or password');
  }

  res.locals.audit = { action: 'LOGIN', entity: 'User', entityId: user._id, user, summary: `${user.name} signed in` };
  res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token: generateToken(user),
    user: publicUser(user),
  });
}));

router.get('/me', protect, (req, res) => {
  res.json({ success: true, data: publicUser(req.user) });
});

module.exports = router;
