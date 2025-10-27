const mongoose = require('mongoose');

const ImageSchema = new mongoose.Schema({
  // Reference to product (nullable)
  productId: { type: String, index: true },
  
  // Reference to variant (nullable)
  variantId: { type: String, index: true },
  
  // Cloudinary URL
  url: [{ type: String, required: true }],
  
  // Additional metadata
  alt_text: String,
  
  // Status
  active: { type: Boolean, default: true }
}, { timestamps: true });

// Compound indexes for efficient queries
ImageSchema.index({ productId: 1, active: 1 });
ImageSchema.index({ variantId: 1, active: 1 });

module.exports = mongoose.model('Image', ImageSchema);
