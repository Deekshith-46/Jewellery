const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  shippingAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  subtotal: Number,
  tax: Number,
  shippingCost: Number,
  discount: Number,
  finalTotal: Number,
  status: { type: String, default: 'pending' },
  paymentStatus: { type: String, default: 'pending' },
  couponCode: String,
  items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OrderItem' }]
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);


