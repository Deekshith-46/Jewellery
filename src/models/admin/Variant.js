const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
  // Reference to master product (ObjectId reference)
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
  
  // Also store productSku for easy lookup (required for upsert)
  productSku: { type: String, required: true, index: true },
  
  // SKU for this specific variant (unique identifier)
  variant_sku: { type: String, required: true, unique: true },
  
  // Variant specifications
  metal_type: { type: String, required: true }, // e.g., 14k_yellow, 18k_white, platinum
  carat: { type: Number, required: true }, // diamond carat weight
  shape: { type: String, required: true }, // Round, Princess, Oval
  diamond_type: String, // Natural / Lab Grown
  
  // NEW: Code mappings for image generation (from Excel Lookups)
  metal_code: String, // e.g., "14Y", "14W", "14R", "18Y", "18W", "P"
  shape_code: String, // e.g., "RND", "OVL", "PRN", "CUS", "EMR", "RAD", "BAG"
  
  // Pricing and inventory
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  readyToShip: { type: Boolean, default: true },
  
  // Metal details
  weight_metal: Number, // metal weight in grams
  metal_cost: Number, // cost of metal
  
  // Image reference
  default_image: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
  
  // Status
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Compound index for fast variant lookup by common query fields
VariantSchema.index({ productSku: 1, metal_type: 1, carat: 1, shape: 1 });
VariantSchema.index({ product: 1, metal_type: 1, carat: 1, shape: 1 });

// Additional indexes for common queries
VariantSchema.index({ productSku: 1, active: 1 });
VariantSchema.index({ product: 1, active: 1 });
VariantSchema.index({ variant_sku: 1 });
VariantSchema.index({ productSku: 1, metal_code: 1, shape_code: 1 });

module.exports = mongoose.model('Variant', VariantSchema);
