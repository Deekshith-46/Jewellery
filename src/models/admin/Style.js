const mongoose = require('mongoose');
const { STYLE_NAMES } = require('./enums');

const StyleSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  name: { type: String, enum: STYLE_NAMES }
}, { timestamps: true });

module.exports = mongoose.model('Style', StyleSchema);


