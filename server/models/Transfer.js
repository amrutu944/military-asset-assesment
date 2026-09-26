const mongoose = require('mongoose');
const { BASES, ASSET_TYPES } = require('../config/constants');

const TransferSchema = new mongoose.Schema(
  {
    asset:         { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: [true, 'Asset is required'] },
    assetName:     { type: String, required: true },
    assetType:     { type: String, required: true, enum: ASSET_TYPES },
    fromBase:      { type: String, required: [true, 'Source base is required'], enum: BASES },
    toBase:        { type: String, required: [true, 'Destination base is required'], enum: BASES },
    quantity:      { type: Number, required: [true, 'Quantity is required'], min: [1, 'Transfer quantity must be at least 1'] },
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // When stock actually moved; movements on the dashboard are dated by this
    approvedAt:    { type: Date, default: null, index: true },
    notes:         { type: String, default: '' },
    decisionNote:  { type: String, default: '' },
  },
  { timestamps: true }
);

TransferSchema.index({ fromBase: 1, status: 1, approvedAt: -1 });
TransferSchema.index({ toBase: 1, status: 1, approvedAt: -1 });

module.exports = mongoose.model('Transfer', TransferSchema);
