const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  // Primary identifier from spreadsheet
  productSku: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  }, // RING-001, RING-002, etc.
  
  // Product details from Products sheet
  productName: { type: String },
  description: { type: String },
  categories: { type: String }, // e.g., "Engagement"
  style: { type: String }, // e.g., "Side Stone", "Pave", "Halo"
  defaultShape: { type: String }, // e.g., "Round", "Cushion", "Oval"
  defaultMetalWeight: { type: Number }, // Optional
  defaultPrice: { type: Number },
  discountPercent: { type: Number },
  
  // Image URLs from Products sheet
  imageUrl1: { type: String },
  imageUrl2: { type: String },
  
  // Status flags
  readyToShip: { type: Boolean, default: false },
  engravingAllowed: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  
  // Delivery information
  lead_days: { type: Number }, // Number of days for delivery
  delivery_date: { type: Date } // Expected delivery date
}, { timestamps: true });

// Indexes for efficient queries
ProductSchema.index({ productSku: 1 });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ active: 1 });

module.exports = mongoose.model('Product', ProductSchema);


