const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
  // Reference to master product
  productSku: { type: String, required: true, index: true },
  
  // SKU for this specific variant
  variant_sku: { type: String, required: true, unique: true },
  
  // Variant specifications
  metal_type: { type: String, required: true }, // e.g., 14k_yellow, 18k_white, platinum
  carat: { type: Number, required: true }, // diamond carat weight
  shape: { type: String, required: true }, // Round, Princess, Oval
  diamond_type: String, // Natural / Lab Grown
  
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
// This will speed up queries like: find variant by productSku + metal_type + carat + shape
VariantSchema.index({ productSku: 1, metal_type: 1, carat: 1, shape: 1 });

// Additional indexes for common queries
VariantSchema.index({ productSku: 1, active: 1 });
VariantSchema.index({ variant_sku: 1 });

module.exports = mongoose.model('Variant', VariantSchema);
