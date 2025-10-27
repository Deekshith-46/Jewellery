const Variant = require('../../models/admin/Variant');
const Product = require('../../models/admin/Product');

// Find variant by productId and specifications
exports.findVariant = async (req, res, next) => {
  try {
    const { productId, metal_type, carat, shape, diamond_type } = req.query;
    
    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const query = { productId, active: true };
    if (metal_type) query.metal_type = metal_type;
    if (carat) query.carat = Number(carat);
    if (shape) query.shape = shape;
    if (diamond_type) query.diamond_type = diamond_type;

    const variant = await Variant.findOne(query);
    
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    res.json(variant);
  } catch (err) {
    next(err);
  }
};

// Get all variants for a product
exports.getVariantsByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { active = true, inStock = false } = req.query;

    const query = { productId };
    if (active !== undefined) query.active = active === 'true';
    if (inStock === 'true') query.stock = { $gt: 0 };

    const variants = await Variant.find(query).sort({ metal_type: 1, carat: 1, shape: 1 });
    res.json(variants);
  } catch (err) {
    next(err);
  }
};

// Get available options for a product (distinct metals, shapes, carats from variants)
exports.getAvailableOptions = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { inStock = true } = req.query;

    const query = { productId, active: true };
    if (inStock === 'true') query.stock = { $gt: 0 };

    const variants = await Variant.find(query);
    
    const options = {
      metals: [...new Set(variants.map(v => v.metal_type).filter(Boolean))],
      shapes: [...new Set(variants.map(v => v.shape).filter(Boolean))],
      carats: [...new Set(variants.map(v => v.carat).filter(Boolean))].sort((a, b) => a - b),
      diamond_types: [...new Set(variants.map(v => v.diamond_type).filter(Boolean))]
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
    
    // Generate variantId if not provided
    if (!variantData.variantId) {
      variantData.variantId = `${variantData.productId}-${variantData.metal_type}-${variantData.carat}-${variantData.shape}`;
    }

    const variant = new Variant(variantData);
    await variant.save();
    
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

    const variant = await Variant.findByIdAndUpdate(id, updateData, { new: true });
    
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
