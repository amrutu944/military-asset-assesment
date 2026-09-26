const mongoose = require('mongoose');
const { BASES, ASSET_TYPES } = require('../config/constants');

const AssignmentSchema = new mongoose.Schema(
  {
    asset:       { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: [true, 'Asset is required'] },
    assetName:   { type: String, required: true },
    assetType:   { type: String, required: true, enum: ASSET_TYPES },
    assignedTo:  { type: String, required: [true, 'Assignee name is required'], trim: true },
    serviceId:   { type: String, trim: true, default: '' },
    rank:        { type: String, trim: true, default: '' },
    unit:        { type: String, trim: true, default: '' },
    base:        { type: String, required: [true, 'Base is required'], enum: BASES },
    quantity:    { type: Number, required: [true, 'Quantity is required'], min: [1, 'Assignment quantity must be at least 1'] },
    assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose:     { type: String, default: '' },
    assignedAt:  { type: Date, default: Date.now, index: true },
    status:      { type: String, enum: ['active', 'returned', 'expended'], default: 'active' },
    closedAt:    { type: Date, default: null },
    closedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AssignmentSchema.index({ base: 1, assetType: 1, assignedAt: -1 });

module.exports = mongoose.model('Assignment', AssignmentSchema);
