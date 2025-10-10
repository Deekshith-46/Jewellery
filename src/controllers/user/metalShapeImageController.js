const mongoose = require('mongoose');
const MetalShapeImage = require('../../models/admin/MetalShapeImage');
const MetalShapeImageImages = require('../../models/admin/MetalShapeImageImages');

// GET /user/products/:id/metal-shape-images?metalId=...&shapeId=...
exports.getByProductMetalShape = async (req, res, next) => {
  try {
    const { id: productId } = req.params;
    const { metalId, shapeId } = req.query;

    if (!metalId || !shapeId) {
      return res.status(400).json({ message: 'metalId and shapeId are required' });
    }

    const isValidObjectId = (v) => mongoose.Types.ObjectId.isValid(String(v));
    if (!isValidObjectId(productId) || !isValidObjectId(metalId) || !isValidObjectId(shapeId)) {
      return res.status(400).json({ message: 'Invalid productId, metalId, or shapeId' });
    }

    const primary = await MetalShapeImage.findOne({ productId, metalId, shapeId });
    if (!primary) {
      return res.status(404).json({ message: 'Not found' });
    }

    const images = await MetalShapeImageImages.findOne({ metalShapeImageId: primary._id });
    return res.json({ primary, images });
  } catch (err) {
    next(err);
  }
};


