const mongoose = require('mongoose');
const slugify = require('slugify');

const ProductSchema = new mongoose.Schema({
  productSku: { type: String, unique: true, sparse: true, index: true },
  // normalized fields
  productName: String,
  slug: { type: String, index: true },
  description: String,
  categoryId: { type: String },
  styleId: { type: String },
  stock: { type: Number, default: 0 },
  metalType: { type: String },
  shape: { type: String },
  metalWeight: Number,
  metalCost: Number,
  metalPrice: Number,
  availability: { type: String, enum: ['available','limited','out_of_stock'], default: 'available' },
  // arrays
  defaultImages: [{ type: String }],
  variantImages: [{ type: String }],
  availableMetalTypes: [{ type: String }],
  availableShapes: [{ type: String }],
  readyToShip: { type: Boolean, default: false },
  engravingAllowed: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  // raw Excel-compatible fields (stored as-is for completeness
}, { timestamps: true });

ProductSchema.pre('validate', function(next) {
  if (!this.slug && this.productName) {
    this.slug = slugify(this.productName, { lower: true });
  }
  next();
});

ProductSchema.index({ productName: 'text', description: 'text' });

// Ensure uniqueness of slug only when it exists (avoid dup key on null)
ProductSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { slug: { $type: 'string' } } }
);

module.exports = mongoose.model('Product', ProductSchema);


