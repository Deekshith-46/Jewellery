const mongoose = require('mongoose');

const DiamondSpecSchema = new mongoose.Schema({
  // Core identification
  sku: { type: String, unique: true, index: true },
  stock: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  location: String,
  
  // Diamond specifications
  shape: { type: mongoose.Schema.Types.ObjectId, ref: 'Shape' },
  carat: Number,
  sizeRange: String,
  color: String,
  purity: String, // clarity
  cut: String,
  polish: String,
  symmetry: String,
  fluorescence: String,
  measurement: String,
  ratio: String,
  lab: String,
  
  // Pricing
  pricePerCarat: Number,
  price: { type: Number, index: true },
  
  // Certificate
  certNumber: String,
  certUrl: String,
  
  // Physical measurements
  table: Number,
  crownHeight: Number,
  pavilionDepth: Number,
  depth: Number,
  crownAngle: Number,
  pavilionAngle: Number,
  
  // Additional info
  comment: String,
  videoUrl: String,
  imageUrl: String,
  active: { type: Boolean, default: true }
  // Legacy fields for backward compatibilit
}, { timestamps: true });

// Indexes for filtering
DiamondSpecSchema.index({ price: 1, carat: 1 });
DiamondSpecSchema.index({ shape: 1 });
DiamondSpecSchema.index({ cut: 1 });
DiamondSpecSchema.index({ color: 1 });
DiamondSpecSchema.index({ purity: 1 });
DiamondSpecSchema.index({ available: 1 });
DiamondSpecSchema.index({ active: 1 });

module.exports = mongoose.model('DiamondSpec', DiamondSpecSchema);


