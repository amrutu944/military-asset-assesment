const Asset = require('../models/Asset');

// Atomically removes stock. The quantity check and the decrement happen in one
// operation, so two concurrent requests can never overdraw the same asset.
// Returns the updated asset, or null when there is not enough on hand.
const takeStock = (assetId, quantity) =>
  Asset.findOneAndUpdate(
    { _id: assetId, quantity: { $gte: quantity } },
    { $inc: { quantity: -quantity } },
    { new: true }
  );

const returnStock = (assetId, quantity) =>
  Asset.findByIdAndUpdate(assetId, { $inc: { quantity } }, { new: true });

// Adds stock to the matching asset line at a base, creating the line if needed
const addStock = ({ name, assetType, base, quantity, unitCost, userId }) =>
  Asset.findOneAndUpdate(
    { name, assetType, base },
    {
      $inc: { quantity },
      $set: { isActive: true, ...(unitCost ? { unitCost } : {}) },
      $setOnInsert: { purchasedBy: userId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

module.exports = { takeStock, returnStock, addStock };
