const express = require('express');
const router = express.Router();
const Transfer = require('../models/Transfer');
const Asset = require('../models/Asset');
const { protect, authorize, scopedBase, canAccessBase } = require('../middleware/auth');
const { asyncHandler, dateRange, positiveInt, HttpError } = require('../utils/http');
const { takeStock, addStock } = require('../utils/stock');
const { BASES, ASSET_TYPES } = require('../config/constants');

router.use(protect, authorize('admin', 'base_commander', 'logistics_officer'));

// Works for both queries and documents
const populateTransfer = (q) => q.populate([
  { path: 'transferredBy', select: 'name role' },
  { path: 'approvedBy', select: 'name role' },
]);

// Moves the stock for a transfer: debit source atomically, credit destination.
const execute = async (transfer, approver) => {
  const source = await takeStock(transfer.asset, transfer.quantity);
  if (!source) throw new HttpError(400, `Insufficient stock at ${transfer.fromBase} to complete this transfer`);

  await addStock({
    name: transfer.assetName,
    assetType: transfer.assetType,
    base: transfer.toBase,
    quantity: transfer.quantity,
    unitCost: source.unitCost,
    userId: approver._id,
  });

  transfer.status = 'approved';
  transfer.approvedBy = approver._id;
  transfer.approvedAt = new Date();
  await transfer.save();
};

// GET /api/transfers?base=&direction=in|out&status=&assetType=&from=&to=
router.get('/', asyncHandler(async (req, res) => {
  const query = {};
  const base = scopedBase(req);
  if (base) {
    if (req.query.direction === 'in') query.toBase = base;
    else if (req.query.direction === 'out') query.fromBase = base;
    else query.$or = [{ fromBase: base }, { toBase: base }];
  }
  if (['pending', 'approved', 'rejected'].includes(req.query.status)) query.status = req.query.status;
  if (ASSET_TYPES.includes(req.query.assetType)) query.assetType = req.query.assetType;
  const range = dateRange(req.query.from, req.query.to);
  if (range) query.createdAt = range;

  const transfers = await populateTransfer(Transfer.find(query)).sort({ createdAt: -1 }).limit(1000).lean();
  res.json({ success: true, count: transfers.length, data: transfers });
}));

// POST /api/transfers — admins and commanders execute immediately;
// logistics officers raise a request that the sending base's commander approves.
router.post('/', asyncHandler(async (req, res) => {
  const { assetId, toBase, notes } = req.body;
  const quantity = positiveInt(req.body.quantity);

  if (!BASES.includes(toBase)) throw new HttpError(400, 'Invalid destination base');
  const asset = await Asset.findById(assetId);
  if (!asset || !asset.isActive) throw new HttpError(404, 'Asset not found');
  if (!canAccessBase(req.user, asset.base)) throw new HttpError(403, 'You can only transfer assets out of your own base');
  if (asset.base === toBase) throw new HttpError(400, 'Source and destination base must differ');
  if (asset.quantity < quantity) throw new HttpError(400, `Insufficient quantity. Available: ${asset.quantity}`);

  const transfer = await Transfer.create({
    asset: asset._id,
    assetName: asset.name,
    assetType: asset.assetType,
    fromBase: asset.base,
    toBase,
    quantity,
    transferredBy: req.user._id,
    notes,
  });

  const autoApprove = req.user.role !== 'logistics_officer';
  if (autoApprove) {
    try {
      await execute(transfer, req.user);
    } catch (err) {
      await transfer.deleteOne();
      throw err;
    }
  }
  await populateTransfer(transfer);

  res.locals.audit = {
    action: autoApprove ? 'TRANSFER_EXECUTE' : 'TRANSFER_REQUEST', entity: 'Transfer', entityId: transfer._id, base: asset.base,
    summary: `${quantity} × ${asset.name}: ${asset.base} → ${toBase}${autoApprove ? '' : ' (awaiting approval)'}`,
  };
  res.status(201).json({
    success: true,
    message: autoApprove
      ? `Transferred ${quantity} × ${asset.name} to ${toBase}`
      : 'Transfer request submitted — awaiting commander approval',
    data: transfer,
  });
}));

const decide = (approve) => asyncHandler(async (req, res) => {
  const transfer = await Transfer.findById(req.params.id);
  if (!transfer) throw new HttpError(404, 'Transfer not found');
  if (!canAccessBase(req.user, transfer.fromBase)) {
    throw new HttpError(403, 'Only the sending base commander or an admin can decide this transfer');
  }
  if (transfer.status !== 'pending') throw new HttpError(400, `Transfer is already ${transfer.status}`);

  transfer.decisionNote = req.body?.note || '';
  if (approve) {
    await execute(transfer, req.user);
  } else {
    transfer.status = 'rejected';
    transfer.approvedBy = req.user._id;
    transfer.approvedAt = new Date();
    await transfer.save();
  }
  await populateTransfer(transfer);

  res.locals.audit = {
    action: approve ? 'TRANSFER_APPROVE' : 'TRANSFER_REJECT', entity: 'Transfer', entityId: transfer._id, base: transfer.fromBase,
    summary: `${approve ? 'Approved' : 'Rejected'} ${transfer.quantity} × ${transfer.assetName}: ${transfer.fromBase} → ${transfer.toBase}`,
  };
  res.json({ success: true, message: `Transfer ${approve ? 'approved' : 'rejected'}`, data: transfer });
});

router.put('/:id/approve', authorize('admin', 'base_commander'), decide(true));
router.put('/:id/reject', authorize('admin', 'base_commander'), decide(false));

module.exports = router;
