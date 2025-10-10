const WishlistItem = require('../../models/user/WishlistItem');
const Product = require('../../models/admin/Product');
const DiamondSpec = require('../../models/admin/DiamondSpec');

exports.addWish = async (req, res, next) => {
  try {
    const { productId, diamondSpecId } = req.body;
    if (!productId && !diamondSpecId) {
      return res.status(400).json({ message: 'Provide productId or diamondSpecId' });
    }
    if (productId && diamondSpecId) {
      return res.status(400).json({ message: 'Provide only one of productId or diamondSpecId' });
    }

    // Validate referenced document exists to avoid dangling refs
    if (productId) {
      if (!require('mongoose').Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ message: 'Invalid productId' });
      }
      const exists = await Product.findById(productId).select('_id');
      if (!exists) return res.status(400).json({ message: 'Product not found' });
    }
    if (diamondSpecId) {
      if (!require('mongoose').Types.ObjectId.isValid(diamondSpecId)) {
        return res.status(400).json({ message: 'Invalid diamondSpecId' });
      }
      const exists = await DiamondSpec.findById(diamondSpecId).select('_id');
      if (!exists) return res.status(400).json({ message: 'Diamond not found' });
    }

    const doc = new WishlistItem({ userId: req.user._id, productId, diamondSpecId });
    await doc.save();
    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Already in wishlist' });
    next(err);
  }
};

exports.deleteWish = async (req, res, next) => {
  try {
    const d = await WishlistItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!d) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.getAllByUser = async (req, res, next) => {
  try {
    const items = await WishlistItem.find({ userId: req.user._id })
      .populate({ path: 'productId', select: 'name slug basePrice metalPrice images metalId styleId shapeId active' })
      .populate({ path: 'diamondSpecId', select: 'sku shapeId carat cut color clarity price available' })
      .lean();
    res.json(items);
  } catch (err) { next(err); }
};

