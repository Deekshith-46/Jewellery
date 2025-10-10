const mongoose = require('mongoose');

const ImageInfoSchema = new mongoose.Schema({
  url: String,
  public_id: String
}, { _id: false });

const MetalShapeImageImagesSchema = new mongoose.Schema({
  metalShapeImageId: { type: mongoose.Schema.Types.ObjectId, ref: 'MetalShapeImage', index: true, unique: true },
  front: ImageInfoSchema,
  top: ImageInfoSchema,
  hand: ImageInfoSchema,
  diagram: ImageInfoSchema,
  altText: {
    front: String,
    top: String,
    hand: String,
    diagram: String
  }
}, { timestamps: true });

module.exports = mongoose.model('MetalShapeImageImages', MetalShapeImageImagesSchema);


