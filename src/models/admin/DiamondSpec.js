const mongoose = require('mongoose');

const DiamondSpecSchema = new mongoose.Schema({
  sku: { type: String, unique: true, index: true },
  shapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shape' },
  shape: String, // optional denormalized shape name/code
  carat: Number,
  cut: String,
  clarity: String,
  color: String,
  labGrown: Boolean,
  price: { type: Number, index: true },
  stock: { type: Number, default: 0 },
  certificate: String,
  certificateUrl: String,
  available: { type: Boolean, default: true },
  // extra metadata fields from spreadsheet (all optional)
  location: String,
  size: String,
  sizeRange: String,
  polish: String,
  symmetry: String,
  fluorescence: String,
  measurement: String,
  ratio: String,
  lab: String,
  pricePerCarat: Number,
  tablePct: Number,
  crownHeight: Number,
  pavilionDepth: Number,
  depthPct: Number,
  crownAngle: Number,
  pavilionAngle: Number,
  comment: String,
  videoUrl: String,
  imageUrl: String
}, { timestamps: true });

DiamondSpecSchema.index({ price: 1, carat: 1 });

module.exports = mongoose.model('DiamondSpec', DiamondSpecSchema);


