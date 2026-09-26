const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const { protect, authorize, scopedBase, canAccessBase } = require('../middleware/auth');
const { asyncHandler, dateRange, positiveInt, searchRegex, HttpError } = require('../utils/http');
const { addStock } = require('../utils/stock');
const { BASES, ASSET_TYPES } = require('../config/constants');

router.use(protect, authorize('admin', 'base_commander', 'logistics_officer'));

// GET /api/purchases?base=&assetType=&from=&to=&search=
router.get('/', asyncHandler(async (req, res) => {
  const query = {};
  const base = scopedBase(req);
  if (base) query.base = base;
  if (ASSET_TYPES.includes(req.query.assetType)) query.assetType = req.query.assetType;
  const range = dateRange(req.query.from, req.query.to);
  if (range) query.purchaseDate = range;
  if (req.query.search) query.assetName = searchRegex(req.query.search);

  const purchases = await Purchase.find(query)
    .populate('purchasedBy', 'name role')
    .sort({ purchaseDate: -1 })
    .limit(1000)
    .lean();

  const totals = purchases.reduce(
    (acc, p) => ({ quantity: acc.quantity + p.quantity, cost: acc.cost + (p.totalCost || 0) }),
    { quantity: 0, cost: 0 }
  );

  res.json({ success: true, count: purchases.length, totals, data: purchases });
}));

// POST /api/purchases — records the purchase and adds it to the base's stock
router.post('/', asyncHandler(async (req, res) => {
  const { assetName, assetType, base, unitCost = 0, supplier, reference, notes, purchaseDate } = req.body;
  const quantity = positiveInt(req.body.quantity);
  const name = (assetName || '').trim();

  if (!name) throw new HttpError(400, 'Asset name is required');
  if (!ASSET_TYPES.includes(assetType)) throw new HttpError(400, 'Invalid asset type');
  if (!BASES.includes(base)) throw new HttpError(400, 'Invalid base');
  if (!canAccessBase(req.user, base)) throw new HttpError(403, 'You can only record purchases for your own base');

  const date = purchaseDate ? new Date(purchaseDate) : new Date();
  if (Number.isNaN(date.getTime()) || date > new Date()) throw new HttpError(400, 'Purchase date cannot be in the future');

  const cost = Math.max(0, Number(unitCost) || 0);
  const asset = await addStock({ name, assetType, base, quantity, unitCost: cost, userId: req.user._id });

  const purchase = await Purchase.create({
    asset: asset._id,
    assetName: name,
    assetType,
    base,
    quantity,
    unitCost: cost,
    totalCost: cost * quantity,
    supplier,
    reference,
    notes,
    purchaseDate: date,
    purchasedBy: req.user._id,
  });
  await purchase.populate('purchasedBy', 'name role');

  res.locals.audit = {
    action: 'PURCHASE_CREATE', entity: 'Purchase', entityId: purchase._id, base,
    summary: `Purchased ${quantity} × ${name} (${assetType}) for ${base}`,
  };
  res.status(201).json({ success: true, message: `${quantity} × ${name} added to ${base}`, data: purchase });
}));

module.exports = router;
