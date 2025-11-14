const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  // Reference to product (ObjectId reference, nullable)
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
  
  // Also store productSku for easy lookup
  productSku: { type: String, index: true },
  
  // Reference to variant (ObjectId reference, nullable)
  variant: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpandedVariant', index: true },
  
  // Also store variant_sku for easy lookup
  variant_sku: { type: String, index: true },
  
  // Two separate image URLs
  image_url_1: { type: String },
  
  // Additional metadata
  alt_text: String,
  sort_order: { type: Number, default: 0 },
  
  // Status
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Compound indexes for efficient queries
ImageSchema.index({ productSku: 1, active: 1 });
ImageSchema.index({ product: 1, active: 1 });
ImageSchema.index({ variant_sku: 1, active: 1 });
ImageSchema.index({ variant: 1, active: 1 });
// Unique index based on product, variant, and sort order (to prevent duplicates)
ImageSchema.index({ productSku: 1, variant_sku: 1, sort_order: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Image', ImageSchema);
