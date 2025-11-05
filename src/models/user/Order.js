const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  // Item type: 'rts' (Ready-to-Ship) or 'dyo' (Design-Your-Own)
  itemType: {
    type: String,
    enum: ['rts', 'dyo'],
    required: true
  },
  
  // For RTS: Variant reference
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Variant'
  },
  variant_sku: String,
  
  // For DYO: Product + selections
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  productSku: String,
  productName: String,
  
  // DYO selections (stored for order history)
  selectedMetal: String,
  selectedShape: String,
  selectedCarat: Number,
  selectedDiamond: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiamondSpec'
  },
  diamondSku: String,
  
  // Order item details
  quantity: { 
    type: Number, 
    required: true,
    min: 1 
  },
  pricePerItem: { 
    type: Number, 
    required: true 
  },
  totalPrice: { 
    type: Number, 
    required: true 
  },
  
  // Price breakdown for DYO items (stored at order time for history)
  priceBreakdown: {
    metal_cost: Number,          // Metal cost = rate_per_gram × metal_weight
    diamond_price: Number,       // Diamond price from Diamonds table
    metal_weight: Number         // Metal weight in grams
  },
  
  // Optional customizations
  engraving: String,
  specialInstructions: String,
  
  // Snapshot of item details at time of order
  itemSnapshot: {
    title: String,
    description: String,
    images: [String],
    specifications: mongoose.Schema.Types.Mixed
  }
}, { _id: true, timestamps: true });

const OrderSchema = new mongoose.Schema({
  // Unique order identifier (auto-generated in pre-save hook)
  orderId: { 
    type: String, 
    unique: true, 
    index: true
  },
  
  // User reference
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true, 
    index: true 
  },
  
  // Order items
  items: [OrderItemSchema],
  
  // Pricing breakdown
  subtotal: { 
    type: Number, 
    required: true 
  },
  shippingCost: { 
    type: Number, 
    default: 0 
  },
  taxes: { 
    type: Number, 
    default: 0 
  },
  discount: { 
    type: Number, 
    default: 0 
  },
  total: { 
    type: Number, 
    required: true 
  },
  
  // Order status
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'],
    default: 'Pending',
    index: true
  },
  
  // Contact information
  contactEmail: {
    type: String,
    required: true
  },
  contactPhone: String,
  
  // Shipping information
  shippingAddress: {
    firstName: String,
    lastName: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String
  },
  
  // Billing address (if different)
  billingAddress: {
    firstName: String,
    lastName: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },
  
  // Payment information
  paymentMethod: {
    type: String,
    enum: ['Credit Card', 'Debit Card', 'PayPal', 'Bank Transfer', 'Cash on Delivery'],
    required: true
  },
  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially Refunded'],
    default: 'Pending',
    index: true
  },
  isPaid: {
    type: Boolean,
    default: false,
    index: true
  },
  transactionId: String,
  paidAt: Date,
  
  // Shipping details
  shippingMethod: String,
  trackingNumber: String,
  estimatedDelivery: Date,
  actualDelivery: Date,
  
  // Additional notes
  customerNotes: String,
  adminNotes: String,
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Indexes for efficient queries
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ createdAt: -1 });

// Generate unique order ID before saving
OrderSchema.pre('save', function(next) {
  if (!this.orderId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderId = `ORD-${timestamp}-${random}`;
  }
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
