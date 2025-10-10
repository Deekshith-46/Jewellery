const mongoose = require('mongoose');
const slugify = require('slugify');

const ProductSchema = new mongoose.Schema({
  name: String,
  slug: { type: String, unique: true, index: true },
  description: String,
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  styleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Style' },
  gemstoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gemstone' },
  metalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Metal' },
  metalPrice: Number,
  sizeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Size' },
  shapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shape' },
  engravingAllowed: Boolean,
  engravingOptions: String,
  diamondSpecId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiamondSpec' },
  basePrice: Number,
  stock: { type: Number, default: 0 },
  images: {
    card: String,
    cardHover: String,
    front: String,
    top: String,
    hand: String,
    diamondSpec: String
  },
  active: { type: Boolean, default: true }
}, { timestamps: true });

ProductSchema.pre('validate', function(next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true });
  }
  next();
});

ProductSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', ProductSchema);


