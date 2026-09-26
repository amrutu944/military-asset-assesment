const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Transfer = require('../models/Transfer');
const Assignment = require('../models/Assignment');
const Expenditure = require('../models/Expenditure');
const Asset = require('../models/Asset');
const AuditLog = require('../models/AuditLog');
const { protect, scopedBase } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../utils/http');
const { ASSET_TYPES } = require('../config/constants');

router.use(protect);

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setUTCHours(23, 59, 59, 999); return x; };

const sumByType = (rows) => {
  const out = Object.fromEntries(ASSET_TYPES.map((t) => [t, 0]));
  for (const r of rows) out[r._id] = (out[r._id] || 0) + r.total;
  return out;
};

const total = (byType) => Object.values(byType).reduce((a, b) => a + b, 0);

/*
 * GET /api/dashboard/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&base=&assetType=
 *
 * Balances are derived from the movement ledger, never stored, so they can be
 * reproduced for any period:
 *
 *   Holdings of a base  = everything it owns, including items issued to personnel
 *   Net Movement        = Purchases + Transfers In − Transfers Out
 *   Opening Balance     = Σ(Purchases + In − Out − Expended) before `from`
 *   Closing Balance     = Opening + Net Movement − Expended   (within the period)
 *
 * Assignments do not change holdings (the base still owns the rifle it issued),
 * so they are reported separately as "Assigned".
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const base = scopedBase(req);
  const assetType = ASSET_TYPES.includes(req.query.assetType) ? req.query.assetType : null;

  const to = endOfDay(req.query.to || new Date());
  const from = startOfDay(req.query.from || new Date(to.getTime() - 29 * DAY));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new HttpError(400, 'Invalid date range');
  }

  const typeMatch = assetType ? { assetType } : {};
  const baseMatch = (field) => (base ? { [field]: base } : {});

  const sources = {
    purchases:   { Model: Purchase,    date: 'purchaseDate', match: { ...typeMatch, ...baseMatch('base') }, populate: 'purchasedBy' },
    transferIn:  { Model: Transfer,    date: 'approvedAt',   match: { ...typeMatch, status: 'approved', ...baseMatch('toBase') }, populate: 'transferredBy' },
    transferOut: { Model: Transfer,    date: 'approvedAt',   match: { ...typeMatch, status: 'approved', ...baseMatch('fromBase') }, populate: 'transferredBy' },
    expended:    { Model: Expenditure, date: 'expendedAt',   match: { ...typeMatch, ...baseMatch('base') }, populate: 'expendedBy' },
    assigned:    { Model: Assignment,  date: 'assignedAt',   match: { ...typeMatch, ...baseMatch('base') }, populate: 'assignedBy' },
  };

  const keys = Object.keys(sources);
  const [before, within] = await Promise.all([
    Promise.all(keys.map((k) => {
      const s = sources[k];
      return s.Model.aggregate([
        { $match: { ...s.match, [s.date]: { $lt: from } } },
        { $group: { _id: '$assetType', total: { $sum: '$quantity' } } },
      ]);
    })),
    Promise.all(keys.map((k) => {
      const s = sources[k];
      return s.Model.find({ ...s.match, [s.date]: { $gte: from, $lte: to } })
        .populate(s.populate, 'name role')
        .sort({ [s.date]: -1 })
        .lean();
    })),
  ]);

  const prior = {};
  const period = {};
  const docs = {};
  keys.forEach((k, i) => {
    prior[k] = sumByType(before[i]);
    docs[k] = within[i];
    period[k] = sumByType(within[i].map((d) => ({ _id: d.assetType, total: d.quantity })));
  });

  // Per-type ledger so the UI can show where the totals come from
  const byType = ASSET_TYPES.filter((t) => !assetType || t === assetType).map((type) => {
    const opening = prior.purchases[type] + prior.transferIn[type] - prior.transferOut[type] - prior.expended[type];
    const netMovement = period.purchases[type] + period.transferIn[type] - period.transferOut[type];
    return {
      assetType: type,
      opening,
      purchases: period.purchases[type],
      transferIn: period.transferIn[type],
      transferOut: period.transferOut[type],
      netMovement,
      assigned: period.assigned[type],
      expended: period.expended[type],
      closing: opening + netMovement - period.expended[type],
    };
  });

  const metrics = {
    openingBalance: byType.reduce((s, r) => s + r.opening, 0),
    purchases: total(period.purchases),
    transferIn: total(period.transferIn),
    transferOut: total(period.transferOut),
    assigned: total(period.assigned),
    expended: total(period.expended),
  };
  metrics.netMovement = metrics.purchases + metrics.transferIn - metrics.transferOut;
  metrics.closingBalance = metrics.openingBalance + metrics.netMovement - metrics.expended;

  // Trend: daily buckets, weekly once the range is longer than ~3 months
  const days = Math.round((to - from) / DAY) + 1;
  const bucketDays = days > 92 ? 7 : 1;
  const bucketCount = Math.ceil(days / bucketDays);
  const trend = Array.from({ length: bucketCount }, (_, i) => ({
    date: new Date(from.getTime() + i * bucketDays * DAY).toISOString().slice(0, 10),
    purchases: 0, transferIn: 0, transferOut: 0, expended: 0, assigned: 0, balance: 0,
  }));
  for (const k of keys) {
    for (const d of docs[k]) {
      const idx = Math.min(bucketCount - 1, Math.floor((new Date(d[sources[k].date]) - from) / (bucketDays * DAY)));
      trend[idx][k] += d.quantity;
    }
  }
  let running = metrics.openingBalance;
  for (const b of trend) {
    running += b.purchases + b.transferIn - b.transferOut - b.expended;
    b.balance = running;
  }

  // Current position (not period-bound)
  const assetMatch = { isActive: true, ...typeMatch, ...baseMatch('base') };
  const [onHandByBase, activeByBase, lowStock, pendingTransfers, recentActivity] = await Promise.all([
    Asset.aggregate([{ $match: assetMatch }, { $group: { _id: '$base', total: { $sum: '$quantity' } } }]),
    Assignment.aggregate([
      { $match: { status: 'active', ...typeMatch, ...baseMatch('base') } },
      { $group: { _id: '$base', total: { $sum: '$quantity' } } },
    ]),
    Asset.find({
      ...assetMatch,
      $or: [
        { assetType: 'ammunition', quantity: { $lt: 500 } },
        { assetType: { $ne: 'ammunition' }, quantity: { $lt: 5 } },
      ],
    }).sort({ quantity: 1 }).limit(8).lean(),
    Transfer.countDocuments({ status: 'pending', ...typeMatch, ...(base ? { $or: [{ fromBase: base }, { toBase: base }] } : {}) }),
    AuditLog.find({ success: true, action: { $nin: ['LOGIN', 'LOGIN_FAILED'] }, ...(base ? { base } : {}) })
      .sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const byBase = {};
  for (const r of onHandByBase) byBase[r._id] = { base: r._id, onHand: r.total, assigned: 0 };
  for (const r of activeByBase) (byBase[r._id] ||= { base: r._id, onHand: 0, assigned: 0 }).assigned = r.total;

  const pick = (list, map) => list.slice(0, 200).map(map);
  const who = (u) => u?.name || '—';

  res.json({
    success: true,
    data: {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      scope: { base: base || 'All Bases', assetType: assetType || 'All Types' },
      metrics,
      byType,
      byBase: Object.values(byBase).sort((a, b) => a.base.localeCompare(b.base)),
      trend,
      activeAssignments: activeByBase.reduce((s, r) => s + r.total, 0),
      pendingTransfers,
      lowStock,
      recentActivity,
      details: {
        purchases: pick(docs.purchases, (p) => ({
          _id: p._id, date: p.purchaseDate, assetName: p.assetName, assetType: p.assetType, base: p.base,
          quantity: p.quantity, totalCost: p.totalCost, supplier: p.supplier, by: who(p.purchasedBy),
        })),
        transferIn: pick(docs.transferIn, (t) => ({
          _id: t._id, date: t.approvedAt, assetName: t.assetName, assetType: t.assetType,
          fromBase: t.fromBase, toBase: t.toBase, quantity: t.quantity, by: who(t.transferredBy),
        })),
        transferOut: pick(docs.transferOut, (t) => ({
          _id: t._id, date: t.approvedAt, assetName: t.assetName, assetType: t.assetType,
          fromBase: t.fromBase, toBase: t.toBase, quantity: t.quantity, by: who(t.transferredBy),
        })),
      },
    },
  });
}));

module.exports = router;
