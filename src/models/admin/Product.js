const mongoose = require('mongoose');
const slugify = require('slugify');

const ProductSchema = new mongoose.Schema({
  // Master product identifier
  productId: { type: String, required: true, unique: true, index: true }, // e.g., ring-001
  title: { type: String, required: true },
  sku_master: { type: String }, // optional master SKU
  description: String,
  slug: { type: String, index: true },
  
  // Categories and styling
  categories: [String], // engagement, wedding, etc.
  style: String, // classic, vintage
  main_shape: String, // primary shape if any
  
  // Core functionality flags
  readyToShip: { type: Boolean, default: false }, // TRUE = Ready to Ship, FALSE = Design Your Own
  default_price: Number, // starting price or null
  
  // Image references
  default_images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }],
  
  // Additional features
  engravingAllowed: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  
  // Metadata for extra properties
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

ProductSchema.pre('validate', function(next) {
  // Generate slug from title
  if (!this.slug && this.title) {
    this.slug = slugify(this.title, { lower: true });
  }
  next();
});

// Text search index
ProductSchema.index({ title: 'text', description: 'text' });

// Ensure uniqueness of slug only when it exists (avoid dup key on null)
ProductSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } }
);

module.exports = mongoose.model('Product', ProductSchema);


