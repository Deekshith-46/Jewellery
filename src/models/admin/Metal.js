const mongoose = require('mongoose');
const { METAL_TYPES } = require('./enums');

const MetalSchema = new mongoose.Schema({
  code: { type: String, enum: METAL_TYPES, unique: true },
  name: String,
  basePrice: Number,
  price: { type: Number, default: 0 },
  unit: String,
  available: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Metal', MetalSchema);


