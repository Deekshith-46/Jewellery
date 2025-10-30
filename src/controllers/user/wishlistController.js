const mongoose = require('mongoose');
const WishlistItem = require('../../models/user/WishlistItem');
const Product = require('../../models/admin/Product');
const DiamondSpec = require('../../models/admin/DiamondSpec');

/**
 * Add item to wishlist (Product or Diamond)
 * POST /api/wishlist
 * Body: { productId/productSku, diamondId/diamondSku, itemType }
 */
exports.addToWishlist = async (req, res, next) => {
  try {
    const { productId, productSku, diamondId, diamondSku, itemType } = req.body;
    const userId = req.user._id;

    // Validate itemType
    if (!itemType || !['product', 'diamond'].includes(itemType)) {
      return res.status(400).json({ 
        success: false,
        message: 'itemType is required and must be either "product" or "diamond"' 
      });
    }

    let wishlistData = { userId, itemType };
    let itemDetails = null;

    // Handle Product
    if (itemType === 'product') {
      if (!productId && !productSku) {
        return res.status(400).json({ 
          success: false,
          message: 'Provide productId or productSku for product type' 
        });
      }

      // Find product by ID or SKU
      let product;
      if (productId) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          return res.status(400).json({ 
            success: false,
            message: 'Invalid productId format' 
          });
        }
        product = await Product.findById(productId).select('_id productSku productName title default_price active');
      } else {
        product = await Product.findOne({ productSku }).select('_id productSku productName title default_price active');
      }

      if (!product) {
        return res.status(404).json({ 
          success: false,
          message: 'Product not found' 
        });
      }

      if (!product.active) {
        return res.status(400).json({ 
          success: false,
          message: 'Product is not available' 
        });
      }

      wishlistData.product = product._id;
      wishlistData.productSku = product.productSku;
      itemDetails = {
        _id: product._id,
        productSku: product.productSku,
        productName: product.productName,
        title: product.title,
        price: product.default_price
      };
    }

    // Handle Diamond
    if (itemType === 'diamond') {
      if (!diamondId && !diamondSku) {
        return res.status(400).json({ 
          success: false,
          message: 'Provide diamondId or diamondSku for diamond type' 
        });
      }

      // Find diamond by ID or SKU
      let diamond;
      if (diamondId) {
        if (!mongoose.Types.ObjectId.isValid(diamondId)) {
          return res.status(400).json({ 
            success: false,
            message: 'Invalid diamondId format' 
          });
        }
        diamond = await DiamondSpec.findById(diamondId).select('_id sku shape carat cut color clarity price available active');
      } else {
        diamond = await DiamondSpec.findOne({ sku: diamondSku }).select('_id sku shape carat cut color clarity price available active');
      }

      if (!diamond) {
        return res.status(404).json({ 
          success: false,
          message: 'Diamond not found' 
        });
      }

      if (!diamond.active) {
        return res.status(400).json({ 
          success: false,
          message: 'Diamond is not available' 
        });
      }

      if (!diamond.available) {
        return res.status(400).json({ 
          success: false,
          message: 'Diamond is currently not available' 
        });
      }

      wishlistData.diamond = diamond._id;
      wishlistData.diamondSku = diamond.sku;
      itemDetails = {
        _id: diamond._id,
        sku: diamond.sku,
        shape: diamond.shape,
        carat: diamond.carat,
        cut: diamond.cut,
        color: diamond.color,
        clarity: diamond.clarity,
        price: diamond.price
      };
    }

    // Check if already in wishlist
    const existingQuery = { userId };
    if (itemType === 'product') {
      existingQuery.product = wishlistData.product;
    } else {
      existingQuery.diamond = wishlistData.diamond;
    }

    const existing = await WishlistItem.findOne(existingQuery);
    if (existing) {
      return res.status(400).json({ 
        success: false,
        message: `This ${itemType} is already in your wishlist`,
        wishlistId: existing._id
      });
    }

    // Create wishlist item
    const wishlistItem = new WishlistItem(wishlistData);
    await wishlistItem.save();

    res.status(201).json({
      success: true,
      message: `${itemType === 'product' ? 'Product' : 'Diamond'} added to wishlist`,
      wishlistItem: {
        _id: wishlistItem._id,
        itemType: wishlistItem.itemType,
        addedAt: wishlistItem.createdAt,
        item: itemDetails
      }
    });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Item already in wishlist' 
      });
    }
    next(err);
  }
};

/**
 * Get all wishlist items for logged-in user
 * GET /api/wishlist
 * Query: ?type=product|diamond (optional filter)
 */
exports.getWishlist = async (req, res, next) => {
  try {
    const { type } = req.query;
    const userId = req.user._id;

    // Build query
    const query = { userId };
    if (type && ['product', 'diamond'].includes(type)) {
      query.itemType = type;
    }

    // Fetch wishlist items
    const items = await WishlistItem.find(query)
      .populate({
        path: 'product',
        select: 'productSku productName title description default_price readyToShip categories style main_shape active default_images'
      })
      .populate({
        path: 'diamond',
        select: 'sku shape carat cut color clarity price available active certNo lab'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Format response
    const formattedItems = items.map(item => ({
      _id: item._id,
      itemType: item.itemType,
      addedAt: item.createdAt,
      ...(item.itemType === 'product' && item.product ? {
        product: {
          _id: item.product._id,
          productSku: item.product.productSku,
          productName: item.product.productName,
          title: item.product.title,
          description: item.product.description,
          price: item.product.default_price,
          readyToShip: item.product.readyToShip,
          categories: item.product.categories,
          style: item.product.style,
          shape: item.product.main_shape,
          images: item.product.default_images,
          active: item.product.active
        }
      } : {}),
      ...(item.itemType === 'diamond' && item.diamond ? {
        diamond: {
          _id: item.diamond._id,
          sku: item.diamond.sku,
          shape: item.diamond.shape,
          carat: item.diamond.carat,
          cut: item.diamond.cut,
          color: item.diamond.color,
          clarity: item.diamond.clarity,
          price: item.diamond.price,
          available: item.diamond.available,
          active: item.diamond.active,
          certNo: item.diamond.certNo,
          lab: item.diamond.lab
        }
      } : {})
    }));

    // Get counts
    const productCount = await WishlistItem.countDocuments({ userId, itemType: 'product' });
    const diamondCount = await WishlistItem.countDocuments({ userId, itemType: 'diamond' });

    res.json({
      success: true,
      count: formattedItems.length,
      counts: {
        products: productCount,
        diamonds: diamondCount,
        total: productCount + diamondCount
      },
      items: formattedItems
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Remove item from wishlist
 * DELETE /api/wishlist/:id
 */
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid wishlist item ID' 
      });
    }

    const deleted = await WishlistItem.findOneAndDelete({ 
      _id: id, 
      userId 
    });

    if (!deleted) {
      return res.status(404).json({ 
        success: false,
        message: 'Wishlist item not found or does not belong to you' 
      });
    }

    res.json({
      success: true,
      message: `${deleted.itemType === 'product' ? 'Product' : 'Diamond'} removed from wishlist`,
      removedItem: {
        _id: deleted._id,
        itemType: deleted.itemType
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Check if item is in wishlist
 * POST /api/wishlist/check
 * Body: { productId/productSku, diamondId/diamondSku, itemType }
 */
exports.checkInWishlist = async (req, res, next) => {
  try {
    const { productId, productSku, diamondId, diamondSku, itemType } = req.body;
    const userId = req.user._id;

    if (!itemType || !['product', 'diamond'].includes(itemType)) {
      return res.status(400).json({ 
        success: false,
        message: 'itemType is required' 
      });
    }

    const query = { userId, itemType };

    if (itemType === 'product') {
      if (productId) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          return res.status(400).json({ success: false, message: 'Invalid productId' });
        }
        query.product = productId;
      } else if (productSku) {
        const product = await Product.findOne({ productSku }).select('_id');
        if (!product) {
          return res.json({ success: true, inWishlist: false });
        }
        query.product = product._id;
      } else {
        return res.status(400).json({ success: false, message: 'Provide productId or productSku' });
      }
    }

    if (itemType === 'diamond') {
      if (diamondId) {
        if (!mongoose.Types.ObjectId.isValid(diamondId)) {
          return res.status(400).json({ success: false, message: 'Invalid diamondId' });
        }
        query.diamond = diamondId;
      } else if (diamondSku) {
        const diamond = await DiamondSpec.findOne({ sku: diamondSku }).select('_id');
        if (!diamond) {
          return res.json({ success: true, inWishlist: false });
        }
        query.diamond = diamond._id;
      } else {
        return res.status(400).json({ success: false, message: 'Provide diamondId or diamondSku' });
      }
    }

    const exists = await WishlistItem.findOne(query).select('_id createdAt');

    res.json({
      success: true,
      inWishlist: !!exists,
      ...(exists && {
        wishlistId: exists._id,
        addedAt: exists.createdAt
      })
    });

  } catch (err) {
    next(err);
  }
};

/**
 * Clear entire wishlist or by type
 * DELETE /api/wishlist/clear
 * Query: ?type=product|diamond (optional)
 */
exports.clearWishlist = async (req, res, next) => {
  try {
    const { type } = req.query;
    const userId = req.user._id;

    const query = { userId };
    if (type && ['product', 'diamond'].includes(type)) {
      query.itemType = type;
    }

    const result = await WishlistItem.deleteMany(query);

    res.json({
      success: true,
      message: `Wishlist ${type ? type + 's' : ''} cleared`,
      deletedCount: result.deletedCount
    });

  } catch (err) {
    next(err);
  }
};

