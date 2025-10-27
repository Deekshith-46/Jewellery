const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  // Either variantId OR customBuild should be present
  variantId: { type: String, default: null },
  quantity: { type: Number, default: 1 },
  
  // Custom build object (Design your Own)
  customBuild: {
    productId: String,
    metal_type: String,
    shape: String,
    diamondId: String,
    carat: Number,
    price: Number, // computed quote at time of adding to cart
    metadata: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

const CartSchema = new mongoose.Schema({
  // User identifier (could be email, user ID, or session token)
  userId: { type: String, required: true, index: true },
  
  // Cart items
  items: [CartItemSchema],
  
  // Currency
  currency: { type: String, default: 'USD' },
  
  // Last updated timestamp
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for efficient queries
CartSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Cart', CartSchema);
