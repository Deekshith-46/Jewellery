const Variant = require('../../models/admin/Variant');
const Product = require('../../models/admin/Product');
const mongoose = require('mongoose');

// Find variant by productId/productSku and specifications
exports.findVariant = async (req, res, next) => {
  try {
    const { productId, product, productSku, metal_type, carat, shape, diamond_type } = req.query;
    
    const productIdentifier = productId || product || productSku;
    if (!productIdentifier) {
      return res.status(400).json({ message: 'productId, product, or productSku is required' });
    }

    // Build query - try to match by ObjectId or productSku
    const query = { active: true };
    
    // If it's a valid ObjectId, search by product reference
    if (mongoose.Types.ObjectId.isValid(productIdentifier)) {
      query.product = productIdentifier;
    } else {
      // Otherwise search by productSku
      query.productSku = productIdentifier;
    }
    
    if (metal_type) query.metal_type = metal_type;
    if (carat) query.carat = Number(carat);
    if (shape) query.shape = shape;
    if (diamond_type) query.diamond_type = diamond_type;

    const variant = await Variant.findOne(query).populate('product', 'productSku productName title');
    
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    res.json(variant);
  } catch (err) {
    next(err);
  }
};

// Get all variants (with query parameter support)
exports.getAllVariants = async (req, res, next) => {
  try {
    const { productSku, productId, readyToShip, active, inStock, metal_type, shape, page = 1, limit = 50 } = req.query;

    const query = {};
    
    // Filter by productSku or productId
    if (productSku) {
      query.productSku = productSku;
    } else if (productId) {
      if (mongoose.Types.ObjectId.isValid(productId)) {
        query.product = productId;
      } else {
        query.productSku = productId;
      }
    }
    
    // Filter by readyToShip
    if (readyToShip !== undefined) {
      query.readyToShip = readyToShip === 'true';
    }
    
    // Filter by active status
    if (active !== undefined) {
      query.active = active === 'true';
    } else {
      query.active = true; // Default to active only
    }
    
    // Filter by stock
    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    }
    
    // Filter by metal_type
    if (metal_type) {
      query.metal_type = metal_type;
    }
    
    // Filter by shape
    if (shape) {
      query.shape = shape;
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [variants, total] = await Promise.all([
      Variant.find(query)
        .populate('product', 'productSku productName title')
        .sort({ metal_type: 1, carat: 1, shape: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Variant.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      count: variants.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      variants
    });
  } catch (err) {
    next(err);
  }
};

// Get all variants for a product
exports.getVariantsByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { active, inStock = false } = req.query;

    // Build query - productId can be ObjectId or productSku
    const query = {};
    
    // If it's a valid ObjectId, search by product reference
    if (mongoose.Types.ObjectId.isValid(productId)) {
      query.product = productId;
    } else {
      // Otherwise search by productSku
      query.productSku = productId;
    }
    
    if (active !== undefined) query.active = active === 'true';
    if (inStock === 'true') query.stock = { $gt: 0 };

    const variants = await Variant.find(query)
      .populate('product', 'productSku productName title')
      .sort({ metal_type: 1, carat: 1, shape: 1 });
    
    res.json({
      productId,
      count: variants.length,
      variants
    });
  } catch (err) {
    next(err);
  }
};

// Get available options for a product (distinct metals, shapes, carats from variants)
exports.getAvailableOptions = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { inStock = true } = req.query;

    // Build query - productId can be ObjectId or productSku
    const query = { active: true };
    
    // If it's a valid ObjectId, search by product reference
    if (mongoose.Types.ObjectId.isValid(productId)) {
      query.product = productId;
    } else {
      // Otherwise search by productSku
      query.productSku = productId;
    }
    
    if (inStock === 'true') query.stock = { $gt: 0 };

    const variants = await Variant.find(query);
    
    const options = {
      metals: [...new Set(variants.map(v => v.metal_type).filter(Boolean))],
      shapes: [...new Set(variants.map(v => v.shape).filter(Boolean))],
      carats: [...new Set(variants.map(v => v.carat).filter(Boolean))].sort((a, b) => a - b),
      diamond_types: [...new Set(variants.map(v => v.diamond_type).filter(Boolean))],
      metal_codes: [...new Set(variants.map(v => v.metal_code).filter(Boolean))],
      shape_codes: [...new Set(variants.map(v => v.shape_code).filter(Boolean))]
    };

    res.json(options);
  } catch (err) {
    next(err);
  }
};

// Create variant (admin only)
exports.createVariant = async (req, res, next) => {
  try {
    const variantData = req.body;
    
    // If productSku is provided, find the product and set the ObjectId reference
    if (variantData.productSku && !variantData.product) {
      const product = await Product.findOne({ productSku: variantData.productSku });
      if (product) {
        variantData.product = product._id;
      }
    }
    
    // Generate variant_sku if not provided
    if (!variantData.variant_sku) {
      variantData.variant_sku = `${variantData.productSku}-${variantData.metal_type}-${variantData.carat}-${variantData.shape}`;
    }

    const variant = new Variant(variantData);
    await variant.save();
    
    // Populate product details for response
    await variant.populate('product', 'productSku productName title');
    
    res.status(201).json(variant);
  } catch (err) {
    next(err);
  }
};

// Update variant (admin only)
exports.updateVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const variant = await Variant.findByIdAndUpdate(id, updateData, { new: true })
      .populate('product', 'productSku productName title');
    
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    res.json(variant);
  } catch (err) {
    next(err);
  }
};

// Delete variant (admin only)
exports.deleteVariant = async (req, res, next) => {
  try {
    const { id } = req.params;

    const variant = await Variant.findByIdAndDelete(id);
    
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    res.json({ message: 'Variant deleted successfully' });
  } catch (err) {
    next(err);
  }
};
