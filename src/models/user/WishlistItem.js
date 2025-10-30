const mongoose = require('mongoose');

const WishlistItemSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  // Product reference (for jewelry products)
  product: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    index: true
  },
  productSku: { 
    type: String,
    index: true
  },
  // Diamond reference (for loose diamonds)
  diamond: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'DiamondSpec',
    index: true
  },
  diamondSku: {
    type: String,
    index: true
  },
  // Type of wishlist item
  itemType: {
    type: String,
    enum: ['product', 'diamond'],
    required: true,
    index: true
  }
}, { timestamps: true });

// Ensure user doesn't add same item twice
WishlistItemSchema.index({ userId: 1, product: 1 }, { unique: true, sparse: true });
WishlistItemSchema.index({ userId: 1, diamond: 1 }, { unique: true, sparse: true });

// Compound index for efficient queries
WishlistItemSchema.index({ userId: 1, itemType: 1 });

module.exports = mongoose.model('WishlistItem', WishlistItemSchema);


