const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  label: String,
  firstName: String,
  lastName: String,
  address: String,
  city: String,
  state: String,
  postalCode: String,
  country: String,
  phone: String,
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Address', AddressSchema);


