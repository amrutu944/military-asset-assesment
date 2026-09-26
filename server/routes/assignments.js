const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Expenditure = require('../models/Expenditure');
const Asset = require('../models/Asset');
const { protect, authorize, scopedBase, canAccessBase } = require('../middleware/auth');
const { asyncHandler, dateRange, positiveInt, searchRegex, HttpError } = require('../utils/http');
const { takeStock, returnStock } = require('../utils/stock');
const { ASSET_TYPES, EXPENDITURE_REASONS } = require('../config/constants');

// Personnel assignments and expenditures are base-command decisions;
// logistics officers are deliberately excluded.
router.use(protect, authorize('admin', 'base_commander'));

// ── Assignments ──────────────────────────────────────────────────────────────

// GET /api/assignments?base=&status=&assetType=&from=&to=&search=
router.get('/', asyncHandler(async (req, res) => {
  const query = {};
  const base = scopedBase(req);
  if (base) query.base = base;
  if (['active', 'returned', 'expended'].includes(req.query.status)) query.status = req.query.status;
  if (ASSET_TYPES.includes(req.query.assetType)) query.assetType = req.query.assetType;
  const range = dateRange(req.query.from, req.query.to);
  if (range) query.assignedAt = range;
  if (req.query.search) query.$or = [{ assignedTo: searchRegex(req.query.search) }, { assetName: searchRegex(req.query.search) }];

  const data = await Assignment.find(query)
    .populate('assignedBy', 'name role')
    .populate('closedBy', 'name role')
    .sort({ assignedAt: -1 })
    .limit(1000)
    .lean();
  res.json({ success: true, count: data.length, data });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { assetId, assignedTo, serviceId, rank, unit, purpose } = req.body;
  const quantity = positiveInt(req.body.quantity);
  if (!assignedTo?.trim()) throw new HttpError(400, 'Assignee name is required');

  const asset = await Asset.findById(assetId);
  if (!asset || !asset.isActive) throw new HttpError(404, 'Asset not found');
  if (!canAccessBase(req.user, asset.base)) throw new HttpError(403, 'You can only assign assets from your own base');

  const updated = await takeStock(asset._id, quantity);
  if (!updated) throw new HttpError(400, `Insufficient quantity. Available: ${asset.quantity}`);

  const assignment = await Assignment.create({
    asset: asset._id,
    assetName: asset.name,
    assetType: asset.assetType,
    assignedTo: assignedTo.trim(),
    serviceId, rank, unit, purpose,
    base: asset.base,
    quantity,
    assignedBy: req.user._id,
  });
  await assignment.populate('assignedBy', 'name role');

  res.locals.audit = {
    action: 'ASSIGNMENT_CREATE', entity: 'Assignment', entityId: assignment._id, base: asset.base,
    summary: `Assigned ${quantity} × ${asset.name} to ${[rank, assignedTo].filter(Boolean).join(' ')}`,
  };
  res.status(201).json({ success: true, message: `${quantity} × ${asset.name} assigned to ${assignedTo}`, data: assignment });
}));

const loadActiveAssignment = async (req) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment || !canAccessBase(req.user, assignment.base)) throw new HttpError(404, 'Assignment not found');
  if (assignment.status !== 'active') throw new HttpError(400, `Assignment is already ${assignment.status}`);
  return assignment;
};

// PUT /api/assignments/:id/return — items come back into base stock
router.put('/:id/return', asyncHandler(async (req, res) => {
  const assignment = await loadActiveAssignment(req);
  await returnStock(assignment.asset, assignment.quantity);

  Object.assign(assignment, { status: 'returned', closedAt: new Date(), closedBy: req.user._id });
  await assignment.save();

  res.locals.audit = {
    action: 'ASSIGNMENT_RETURN', entity: 'Assignment', entityId: assignment._id, base: assignment.base,
    summary: `${assignment.assignedTo} returned ${assignment.quantity} × ${assignment.assetName}`,
  };
  res.json({ success: true, message: 'Assets returned to stock', data: assignment });
}));

// PUT /api/assignments/:id/expend — assigned items were consumed/lost in service
router.put('/:id/expend', asyncHandler(async (req, res) => {
  const assignment = await loadActiveAssignment(req);
  const reason = EXPENDITURE_REASONS.includes(req.body.reason) ? req.body.reason : 'other';

  // Stock already left the shelf when it was assigned, so no stock change here
  const expenditure = await Expenditure.create({
    asset: assignment.asset,
    assetName: assignment.assetName,
    assetType: assignment.assetType,
    quantity: assignment.quantity,
    base: assignment.base,
    expendedBy: req.user._id,
    reason,
    notes: req.body.notes || `Expended by ${assignment.assignedTo}`,
    assignment: assignment._id,
  });

  Object.assign(assignment, { status: 'expended', closedAt: new Date(), closedBy: req.user._id });
  await assignment.save();

  res.locals.audit = {
    action: 'ASSIGNMENT_EXPEND', entity: 'Expenditure', entityId: expenditure._id, base: assignment.base,
    summary: `${assignment.quantity} × ${assignment.assetName} assigned to ${assignment.assignedTo} marked expended (${reason})`,
  };
  res.json({ success: true, message: 'Assignment marked as expended', data: assignment });
}));

// ── Expenditures ─────────────────────────────────────────────────────────────

const expenditures = express.Router();
expenditures.use(protect, authorize('admin', 'base_commander'));

expenditures.get('/', asyncHandler(async (req, res) => {
  const query = {};
  const base = scopedBase(req);
  if (base) query.base = base;
  if (ASSET_TYPES.includes(req.query.assetType)) query.assetType = req.query.assetType;
  if (EXPENDITURE_REASONS.includes(req.query.reason)) query.reason = req.query.reason;
  const range = dateRange(req.query.from, req.query.to);
  if (range) query.expendedAt = range;

  const data = await Expenditure.find(query)
    .populate('expendedBy', 'name role')
    .sort({ expendedAt: -1 })
    .limit(1000)
    .lean();
  res.json({ success: true, count: data.length, data });
}));

// POST /api/expenditures — direct expenditure from base stock (e.g. training ammunition)
expenditures.post('/', asyncHandler(async (req, res) => {
  const { assetId, reason, notes } = req.body;
  const quantity = positiveInt(req.body.quantity);
  if (!EXPENDITURE_REASONS.includes(reason)) throw new HttpError(400, 'Invalid reason');

  const asset = await Asset.findById(assetId);
  if (!asset || !asset.isActive) throw new HttpError(404, 'Asset not found');
  if (!canAccessBase(req.user, asset.base)) throw new HttpError(403, 'You can only expend assets from your own base');

  const updated = await takeStock(asset._id, quantity);
  if (!updated) throw new HttpError(400, `Insufficient quantity. Available: ${asset.quantity}`);

  const expenditure = await Expenditure.create({
    asset: asset._id,
    assetName: asset.name,
    assetType: asset.assetType,
    quantity,
    base: asset.base,
    expendedBy: req.user._id,
    reason,
    notes,
  });
  await expenditure.populate('expendedBy', 'name role');

  res.locals.audit = {
    action: 'EXPENDITURE_CREATE', entity: 'Expenditure', entityId: expenditure._id, base: asset.base,
    summary: `Expended ${quantity} × ${asset.name} (${reason})`,
  };
  res.status(201).json({ success: true, message: `${quantity} × ${asset.name} logged as expended`, data: expenditure });
}));

module.exports = { assignments: router, expenditures };
