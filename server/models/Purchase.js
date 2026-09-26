const mongoose = require('mongoose');
const { BASES, ASSET_TYPES } = require('../config/constants');

// Immutable ledger entry: every purchase is recorded here, separately from the
// running stock in Asset. Balances on the dashboard are derived from this ledger.
const PurchaseSchema = new mongoose.Schema(
  {
    asset:        { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    assetName:    { type: String, required: [true, 'Asset name is required'], trim: true },
    assetType:    { type: String, required: true, enum: ASSET_TYPES },
    base:         { type: String, required: true, enum: BASES },
    quantity:     { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    unitCost:     { type: Number, default: 0, min: 0 },
    totalCost:    { type: Number, default: 0 },
    supplier:     { type: String, trim: true, default: '' },
    reference:    { type: String, trim: true, default: '' },
    notes:        { type: String, trim: true, default: '' },
    purchaseDate: { type: Date, default: Date.now, index: true },
    purchasedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PurchaseSchema.index({ base: 1, assetType: 1, purchaseDate: -1 });

module.exports = mongoose.model('Purchase', PurchaseSchema);
