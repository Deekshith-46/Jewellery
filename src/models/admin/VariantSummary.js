const mongoose = require('mongoose');

const VariantSummarySchema = new mongoose.Schema({
  // Product and variant identifiers
  productSku: { type: String, required: true, index: true },
  variantSku: { type: String, required: true, unique: true, index: true },

  // Comma-separated strings in sheet → arrays here
  metalTypes: [{ type: String }],          // e.g., ['14W','18Y','P']
  availableShapes: [{ type: String }],     // e.g., ['RND','OVL','CUS']
  centerStoneWeights: [{ type: Number }],  // e.g., [1,1.5,2,2.5,3]
  sideStoneWeights: [{ type: Number }],    // e.g., [1,1.5,2]

  // Attributes
  metalWeight: { type: Number },
  diamondType: { type: String },

  // Inventory/status
  stock: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  readyToShip: { type: Boolean, default: false }
}, { timestamps: true });

VariantSummarySchema.index({ productSku: 1 });
VariantSummarySchema.index({ variantSku: 1 });
VariantSummarySchema.index({ productSku: 1, active: 1 });

module.exports = mongoose.model('VariantSummary', VariantSummarySchema);


