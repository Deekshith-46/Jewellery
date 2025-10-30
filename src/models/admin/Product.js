const mongoose = require('mongoose');
const slugify = require('slugify');

const ProductSchema = new mongoose.Schema({
  // Master product identifier
  productId: { type: String, required: true, unique: true, index: true }, // e.g., ring-001
  productSku: { type: String, index: true }, // From Excel: RING-001, RING-002, etc.
  title: { type: String, required: true },
  productName: { type: String }, // From Excel product_name
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
  
  // Image references (backward compatibility)
  default_images: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Image' }],
  
  // Additional features
  engravingAllowed: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  
  // ===== NEW: 9 Image Generation Fields from Excel =====
  useAllMetals: { type: Boolean, default: true },
  availableMetalTypes: [String], // CSV metal names if useAllMetals=false
  useAllShapes: { type: Boolean, default: true },
  availableShapes: [String], // CSV shape names if useAllShapes=false
  angles: { type: String, default: '001,002,003,004' }, // Comma-separated angles
  basePath: String, // e.g., "rings/RING-001"
  filenameTemplate: { type: String, default: '{sku}_{shape}_{metal}_{angle}_1600.jpg' },
  metalsExpanded: String, // Comma-separated metal codes: "14W,14Y,14R,18W,18Y,P"
  shapesExpanded: String, // Comma-separated shape codes: "RND,OVL,PRN,CUS,EMR,RAD,ASH,MAR,HRT,PEA,BAG"
  
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


