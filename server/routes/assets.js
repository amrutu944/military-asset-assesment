const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');
const { protect, authorize, scopedBase, canAccessBase } = require('../middleware/auth');
const { asyncHandler, searchRegex, HttpError } = require('../utils/http');
const { ASSET_TYPES } = require('../config/constants');

router.use(protect);

// GET /api/assets?base=&assetType=&search=&inStock=true — current on-hand stock
router.get('/', asyncHandler(async (req, res) => {
  const query = { isActive: true };
  const base = scopedBase(req);
  if (base) query.base = base;
  if (ASSET_TYPES.includes(req.query.assetType)) query.assetType = req.query.assetType;
  if (req.query.inStock === 'true') query.quantity = { $gt: 0 };
  if (req.query.search) query.name = searchRegex(req.query.search);

  const assets = await Asset.find(query).sort({ base: 1, assetType: 1, name: 1 }).lean();
  res.json({ success: true, count: assets.length, data: assets });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).lean();
  if (!asset || !canAccessBase(req.user, asset.base)) throw new HttpError(404, 'Asset not found');
  res.json({ success: true, data: asset });
}));

// Metadata only — quantities change exclusively through purchases, transfers,
// assignments and expenditures so the ledger always reconciles.
router.put('/:id', authorize('admin', 'base_commander'), asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset || !canAccessBase(req.user, asset.base)) throw new HttpError(404, 'Asset not found');

  const { description, unitCost } = req.body;
  if (description !== undefined) asset.description = description;
  if (unitCost !== undefined) asset.unitCost = Math.max(0, Number(unitCost) || 0);
  await asset.save();

  res.locals.audit = { action: 'ASSET_UPDATE', entity: 'Asset', entityId: asset._id, base: asset.base, summary: `Updated details of ${asset.name}` };
  res.json({ success: true, data: asset });
}));

module.exports = router;
