const mongoose = require('mongoose');
const { SIZE_VALUES } = require('./enums');

const SizeSchema = new mongoose.Schema({
  value: { type: Number, enum: SIZE_VALUES, unique: true }
}, { timestamps: true });

module.exports = mongoose.model('Size', SizeSchema);


