const mongoose = require('mongoose');

const MetalSchema = new mongoose.Schema({
  // Metal type identifier from Metals sheet
  metal_type: { type: String, required: true, unique: true, index: true }, // e.g., 14k_white_gold, 18k_yellow_gold, platinum
  
  // Metal code from Metals sheet
  metal_code: { type: String, unique: true, index: true }, // e.g., "14W", "14Y", "14R", "18W", "18Y", "18R", "P"
  
  // Pricing from Metals sheet
  rate_per_gram: { type: Number, required: true },
  price_multiplier: { type: Number, default: 1 }
}, { timestamps: true });

// Indexes for efficient queries
MetalSchema.index({ metal_type: 1 });
MetalSchema.index({ metal_code: 1 });

module.exports = mongoose.model('Metal', MetalSchema);


