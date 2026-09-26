const mongoose = require('mongoose');
const { BASES, ASSET_TYPES } = require('../config/constants');

// Current on-hand stock of one asset line at one base (name + type + base is unique).
// This is the "available" quantity: holdings minus what is currently assigned out.
const AssetSchema = new mongoose.Schema(
  {
    name:        { type: String, required: [true, 'Asset name is required'], trim: true },
    assetType:   { type: String, required: [true, 'Asset type is required'], enum: ASSET_TYPES },
    quantity:    { type: Number, required: true, min: [0, 'Quantity cannot be negative'], default: 0 },
    base:        { type: String, required: [true, 'Base is required'], enum: BASES },
    unitCost:    { type: Number, default: 0 },
    description: { type: String, trim: true, default: '' },
    purchasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

AssetSchema.index({ name: 1, assetType: 1, base: 1 }, { unique: true });

module.exports = mongoose.model('Asset', AssetSchema);
