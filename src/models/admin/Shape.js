const mongoose = require('mongoose');

const ShapeSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  label: String,
  price: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Shape', ShapeSchema);


