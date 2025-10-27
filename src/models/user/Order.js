const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  // Either variantId OR customBuild should be present
  variantId: String,
  customBuild: mongoose.Schema.Types.Mixed,
  
  // Item details
  quantity: { type: Number, default: 1 },
  price: Number, // price at time of order
  
  // Additional metadata
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  // Unique order identifier
  orderId: { type: String, unique: true, required: true },
  
  // User identifier
  userId: { type: String, required: true, index: true },
  
  // Order items
  items: [OrderItemSchema],
  
  // Pricing breakdown
  subtotal: Number,
  shipping: { type: Number, default: 0 },
  taxes: { type: Number, default: 0 },
  total: Number,
  
  // Order status
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending' 
  },
  
  // Shipping information
  shippingAddress: {
    name: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    phone: String
  },
  
  // Payment information
  paymentMethod: String,
  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending' 
  },
  
  // Additional metadata
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Indexes for efficient queries
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model('Order', OrderSchema);