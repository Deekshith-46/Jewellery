const mongoose = require('mongoose');

const DYOExpandedVariantSchema = new mongoose.Schema({
  // Reference to master product (ObjectId reference)
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
  
  // Product SKU from spreadsheet (required for upsert)
  productSku: { type: String, required: true, index: true },
  
  // Unique variant identifier from spreadsheet
  variantSku: { type: String, required: true, unique: true, index: true },
  
  // Product name from DYOExpandedVariants sheet
  productName: { type: String },
  
  // Variant details from DYOExpandedVariants sheet
  metalType: { type: String, required: true }, // e.g., 14k_white_gold, 18k_yellow_gold, platinum
  metalCode: { type: String }, // e.g., "14W", "14Y", "14R", "18W", "18Y", "18R", "P"
  shape_code: { type: String }, // e.g., "RND", "OVL", "PRN", "CUS", "EMR", "RAD", "ASH", "MAR", "HRT", "PEA", "BAG"
  
  // Pricing and weight from DYOExpandedVariants sheet
  metalWeight: { type: Number }, // metal weight in grams
  metalBasePrice: { type: Number }, // base price for metal
  metalPrice: { type: Number }, // final calculated price
  
  // Status flags from DYOExpandedVariants sheet
  readyToShip: { type: Boolean, default: false }, // FALSE for Design Your Own
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes for efficient queries
DYOExpandedVariantSchema.index({ variantSku: 1 });
DYOExpandedVariantSchema.index({ productSku: 1 });
DYOExpandedVariantSchema.index({ product: 1 });
DYOExpandedVariantSchema.index({ productSku: 1, metalCode: 1, shape_code: 1 });
DYOExpandedVariantSchema.index({ productSku: 1, active: 1 });

module.exports = mongoose.model('DYOExpandedVariant', DYOExpandedVariantSchema);

