const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  diamondSpecId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondSpec' },
  metalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Metal' },
  engravingText: String,
  quantity: Number,
  itemPrice: Number
}, { timestamps: true });

module.exports = mongoose.model('OrderItem', OrderItemSchema);


