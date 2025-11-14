const mongoose = require('mongoose');

const ExpandedVariantSchema = new mongoose.Schema({
  // Reference to master product (ObjectId reference)
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },

  // Product and variant identifiers
  productSku: { type: String, required: true, index: true },
  variantSku: { type: String, required: true, index: true },

  // Metal and shape details
  metalType: { type: String, required: true }, // e.g., 14k_white_gold
  metalCode: { type: String }, // e.g., 14W, 14Y, 18R, P
  shape_code: { type: String }, // e.g., RND, OVL, PRN, CUS, EMR

  // Center stone data
  centerStoneWeight: { type: Number },
  centerStonePrice: { type: Number },

  // Side stone data
  sideStoneWeight: { type: Number },
  sideStonePrice: { type: Number },

  // Attributes and pricing
  diamondType: { type: String },
  // Newly added attributes from sheet
  clarity: { type: String },
  color: { type: String },
  cut: { type: String },
  metalWeight: { type: Number },
  metalBasePrice: { type: Number },
  metalPrice: { type: Number },
  totalPrice: { type: Number },

  // Inventory/status
  stock: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Helpful indexes
ExpandedVariantSchema.index({ productSku: 1 });
ExpandedVariantSchema.index({ variantSku: 1 });
ExpandedVariantSchema.index({ product: 1 });
ExpandedVariantSchema.index({ productSku: 1, metalCode: 1, shape_code: 1 });
ExpandedVariantSchema.index({ productSku: 1, active: 1 });
// Ensure each row (variantSku + metalCode + shape_code + centerStoneWeight) is unique
ExpandedVariantSchema.index(
  { variantSku: 1, metalCode: 1, shape_code: 1, centerStoneWeight: 1 },
  { unique: true }
);

module.exports = mongoose.model('ExpandedVariant', ExpandedVariantSchema);


