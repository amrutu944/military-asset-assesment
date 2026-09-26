const mongoose = require('mongoose');
const { BASES, ASSET_TYPES, EXPENDITURE_REASONS } = require('../config/constants');

const ExpenditureSchema = new mongoose.Schema(
  {
    asset:        { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: [true, 'Asset is required'] },
    assetName:    { type: String, required: true },
    assetType:    { type: String, required: true, enum: ASSET_TYPES },
    quantity:     { type: Number, required: [true, 'Quantity is required'], min: [1, 'Expenditure must be at least 1'] },
    base:         { type: String, required: [true, 'Base is required'], enum: BASES },
    expendedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason:       { type: String, required: [true, 'Reason is required'], enum: EXPENDITURE_REASONS },
    notes:        { type: String, default: '' },
    // Set when the expended items came from a personnel assignment
    assignment:   { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', default: null },
    expendedAt:   { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

ExpenditureSchema.index({ base: 1, assetType: 1, expendedAt: -1 });

module.exports = mongoose.model('Expenditure', ExpenditureSchema);
