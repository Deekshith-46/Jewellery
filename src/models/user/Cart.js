const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  // Item type: 'rts' (Ready-to-Ship) or 'dyo' (Design-Your-Own)
  itemType: {
    type: String,
    enum: ['rts', 'dyo'],
    required: true
  },
  
  // For RTS: Reference to variant
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant'
  },
  variant_sku: String,
  
  // For DYO: Product + custom selections
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  productSku: String,
  
  // DYO custom selections
  selectedMetal: String,        // metal_type (e.g., "14k_white_gold")
  selectedShape: String,        // shape (e.g., "Round")
  selectedCarat: Number,        // diamond carat
  selectedDiamond: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiamondSpec'
  },
  diamondSku: String,
  
  // Common fields
  quantity: { 
    type: Number, 
    default: 1,
    min: 1
  },
  
  // Price at time of adding to cart
  pricePerItem: Number,
  totalPrice: Number,
  
  // Price breakdown for DYO items
  priceBreakdown: {
    metal_cost: Number,          // Metal cost = rate_per_gram × metal_weight
    diamond_price: Number,       // Diamond price from Diamonds table
    metal_weight: Number         // Metal weight in grams
  },
  
  // Optional customizations
  engraving: String,
  specialInstructions: String,
  
  // Metadata for additional info
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const CartSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true, 
    unique: true, 
    index: true 
  },
  items: [CartItemSchema],
  
  // Cart totals (computed)
  subtotal: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 }
}, { timestamps: true });

// Update cart totals before saving
CartSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  this.totalItems = this.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  next();
});

module.exports = mongoose.model('Cart', CartSchema);
