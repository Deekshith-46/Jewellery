const mongoose = require('mongoose');

const WishlistItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  diamondSpecId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondSpec' }
}, { timestamps: true });

WishlistItemSchema.index({ userId: 1, productId: 1, diamondSpecId: 1 }, { unique: true });

module.exports = mongoose.model('WishlistItem', WishlistItemSchema);


