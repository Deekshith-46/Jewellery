const mongoose = require('mongoose');
const { CATEGORIES_ENUM } = require('./enums');

const CategorySchema = new mongoose.Schema({
  code: { type: String, enum: CATEGORIES_ENUM, unique: true, index: true },
  label: String,
  description: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);


