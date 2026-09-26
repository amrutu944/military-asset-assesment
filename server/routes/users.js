const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/http');
const { BASES, ROLES } = require('../config/constants');

// Only admins manage accounts. (Previously /auth/register was public, which let
// anyone create an admin account.)
router.use(protect, authorize('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const users = await User.find().sort({ role: 1, base: 1, name: 1 }).lean();
  res.json({ success: true, count: users.length, data: users });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, email, password, role, base } = req.body;
  if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
  if (!BASES.includes(base)) throw new HttpError(400, 'Invalid base');
  if (await User.exists({ email: String(email).toLowerCase() })) {
    throw new HttpError(400, 'A user with this email already exists');
  }

  const user = await User.create({ name, email, password, role, base });
  const data = user.toObject();
  delete data.password;

  res.locals.audit = { action: 'USER_CREATE', entity: 'User', entityId: user._id, base, summary: `Created ${role} ${name} (${base})` };
  res.status(201).json({ success: true, message: 'User created', data });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');

  const { role, base, isActive } = req.body;
  if (user._id.equals(req.user._id) && (isActive === false || (role && role !== 'admin'))) {
    throw new HttpError(400, 'You cannot deactivate or demote your own account');
  }
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw new HttpError(400, 'Invalid role');
    user.role = role;
  }
  if (base !== undefined) {
    if (!BASES.includes(base)) throw new HttpError(400, 'Invalid base');
    user.base = base;
  }
  if (isActive !== undefined) user.isActive = Boolean(isActive);
  await user.save();

  res.locals.audit = {
    action: 'USER_UPDATE', entity: 'User', entityId: user._id, base: user.base,
    summary: `Updated ${user.name}: ${user.role}, ${user.base}, ${user.isActive ? 'active' : 'deactivated'}`,
  };
  res.json({ success: true, message: 'User updated', data: user });
}));

module.exports = router;
