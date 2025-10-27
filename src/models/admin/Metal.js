
const mongoose = require('mongoose');

const MetalSchema = new mongoose.Schema({
  // Metal type identifier (e.g., 14k_yellow, 18k_white, platinum)
  metal_type: { type: String, required: true, unique: true, index: true },
  
  // Daily updated rate per gram for pricing calculations
  rate_per_gram: { type: Number, required: true },
  
  // Multiplier for final price calculation
  price_multiplier: { type: Number, default: 1 }
}, { timestamps: true });

// Index for efficient queries
MetalSchema.index({ metal_type: 1 });

module.exports = mongoose.model('Metal', MetalSchema);


