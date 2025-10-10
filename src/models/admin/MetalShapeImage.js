const mongoose = require('mongoose');

const ImageInfoSchema = new mongoose.Schema({
  url: String,
  public_id: String
}, { _id: false });

const MetalShapeImageSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true },
  metalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Metal', index: true },
  shapeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shape', index: true },
  image: ImageInfoSchema,
  available: { type: Boolean, default: true }
}, { timestamps: true });

MetalShapeImageSchema.index({ productId: 1, metalId: 1, shapeId: 1 }, { unique: true });

module.exports = mongoose.model('MetalShapeImage', MetalShapeImageSchema);


