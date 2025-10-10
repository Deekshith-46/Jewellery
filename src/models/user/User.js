const mongoose = require('mongoose');
const { ROLES } = require('../admin/enums');

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, index: true, lowercase: true },
  password: String,
  role: { type: String, enum: ROLES, default: 'customer' },
  addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Address' }],
  defaultAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);


