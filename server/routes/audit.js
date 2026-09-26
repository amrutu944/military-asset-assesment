const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize, scopedBase } = require('../middleware/auth');
const { asyncHandler, dateRange, searchRegex } = require('../utils/http');

// Admins see the full trail; commanders see activity at their own base.
router.use(protect, authorize('admin', 'base_commander'));

// GET /api/audit?base=&action=&success=&from=&to=&search=&page=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const query = {};
  const base = scopedBase(req);
  if (base) query.base = base;
  if (req.query.action) query.action = req.query.action;
  if (req.query.success === 'true' || req.query.success === 'false') query.success = req.query.success === 'true';
  const range = dateRange(req.query.from, req.query.to);
  if (range) query.createdAt = range;
  if (req.query.search) {
    query.$or = [{ summary: searchRegex(req.query.search) }, { userName: searchRegex(req.query.search) }];
  }

  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const [data, total, actions] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(query),
    AuditLog.distinct('action', base ? { base } : {}),
  ]);

  res.json({ success: true, total, page, pages: Math.ceil(total / limit), actions: actions.sort(), data });
}));

module.exports = router;
