const mongoose = require('mongoose');

const DYOVariantSchema = new mongoose.Schema({
  // Reference to product
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },

  productSku: { type: String, required: true, unique: true, index: true },

  metalTypes: [{ type: String }],   // e.g., ['14W','14Y','18W','18Y','18R','P']
  shapes: [{ type: String }],       // e.g., ['RND','OVL','PRN',...]

  active: { type: Boolean, default: true }
}, { timestamps: true });

DYOVariantSchema.index({ productSku: 1 });
DYOVariantSchema.index({ product: 1 });

module.exports = mongoose.model('DYOVariant', DYOVariantSchema);


