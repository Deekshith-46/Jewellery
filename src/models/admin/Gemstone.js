const mongoose = require('mongoose');
const { GEMSTONE_NAMES } = require('./enums');

const GemstoneSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  name: { type: String, enum: GEMSTONE_NAMES }
}, { timestamps: true });

module.exports = mongoose.model('Gemstone', GemstoneSchema);


