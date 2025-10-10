const mongoose = require('mongoose');

const LookupSchema = new mongoose.Schema({
  type: String,
  key: String,
  value: String
}, { timestamps: true });

module.exports = mongoose.model('Lookup', LookupSchema);


