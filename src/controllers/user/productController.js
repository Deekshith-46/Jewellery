const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Variant = require('../../models/admin/Variant');
const Image = require('../../models/admin/Image');

// List products by tab (Ready to Ship vs Design Your Own)
exports.listProducts = async (req, res, next) => {
  try {
    const { tab = 'ready', page = 1, limit = 24, search, category, style, shape, minPrice, maxPrice, sort = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    let products = [];
    let total = 0;

    if (tab === 'design') {
      // Products that are designable (readyToShip=false)
      const filter = { readyToShip: false, active: true };
      
      // Apply search filter
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Apply category filter
      if (category) {
        filter.categories = { $in: [new RegExp(category, 'i')] };
      }

      // Apply style filter
      if (style) {
        filter.style = { $regex: style, $options: 'i' };
      }

      // Apply shape filter
      if (shape) {
        filter.main_shape = { $regex: shape, $options: 'i' };
      }

      // Apply price filter
      if (minPrice || maxPrice) {
        const priceFilter = {};
        if (minPrice) priceFilter.$gte = Number(minPrice);
        if (maxPrice) priceFilter.$lte = Number(maxPrice);
        filter.default_price = priceFilter;
      }

      products = await Product.find(filter)
        .populate('default_images')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

      total = await Product.countDocuments(filter);
    } else {
      // Ready to ship: products with available variants
      const productIds = await Variant.distinct('productId', { stock: { $gt: 0 }, active: true });
      
      const filter = { productId: { $in: productIds }, active: true };
      
      // Apply search filter
      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Apply category filter
      if (category) {
        filter.categories = { $in: [new RegExp(category, 'i')] };
      }

      // Apply style filter
      if (style) {
        filter.style = { $regex: style, $options: 'i' };
      }

      // Apply shape filter
      if (shape) {
        filter.main_shape = { $regex: shape, $options: 'i' };
      }

      products = await Product.find(filter)
        .populate('default_images')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

      total = await Product.countDocuments(filter);
    }

    res.json({ 
      data: products, 
      total, 
      page: Number(page), 
      pages: Math.ceil(total / limit),
      tab
    });
  } catch (err) {
    next(err);
  }
};

// Get product detail with variants and options
exports.getProductDetail = async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    // Try to find by productId first, then by legacy _id
    let product = await Product.findOne({ productId });
    if (!product) {
      product = await Product.findById(productId);
    }
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find variants for this product
    const variants = await Variant.find({ productSku: product.productId || product._id.toString(), active: true });
    
    // Find images
    const images = await Image.find({ 
      $or: [
        { productSku: product.productId || product._id.toString() },
        { productSku: product.productId }
      ]
    }).sort({ sort_order: 1 });

    res.json({ 
      product, 
      variants, 
      images 
    });
  } catch (err) {
    next(err);
  }
};

// Legacy method for backward compatibility
exports.getAllProducts = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      category, 
      metal_type, 
      metalType,
      style, 
      shape, 
      minPrice, 
      maxPrice, 
      priceMin, 
      priceMax, 
      sort = '-createdAt' 
    } = req.query;
    
    const filter = {};
    
    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category) {
      filter.categories = { $in: [new RegExp(category, 'i')] };
    }

    // Style filter
    if (style) {
      filter.style = { $regex: style, $options: 'i' };
    }

    // Shape filter
    if (shape) {
      filter.main_shape = { $regex: shape, $options: 'i' };
    }

    // Price range filter
    const pMinRaw = priceMin ?? minPrice;
    const pMaxRaw = priceMax ?? maxPrice;
    const pMin = pMinRaw !== undefined && pMinRaw !== '' ? Number(pMinRaw) : undefined;
    const pMax = pMaxRaw !== undefined && pMaxRaw !== '' ? Number(pMaxRaw) : undefined;

    if ((pMin !== undefined && !Number.isNaN(pMin)) || (pMax !== undefined && !Number.isNaN(pMax))) {
      const range = {};
      if (pMin !== undefined && !Number.isNaN(pMin)) range.$gte = pMin;
      if (pMax !== undefined && !Number.isNaN(pMax)) range.$lte = pMax;
      filter.default_price = range;
    }

    // Only show active products
    filter.active = true;

    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 20, 100);

    const query = Product.find(filter)
      .populate('default_images')
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(Number(limitNum));

    const [items, total] = await Promise.all([query.exec(), Product.countDocuments(filter)]);

    res.json({ 
      items, 
      total, 
      page: pageNum, 
      pages: Math.ceil(total / limitNum),
      filters: {
        applied: {
          search: search || null,
          category: category || null,
          metal_type: metal_type || metalType || null,
          style: style || null,
          shape: shape || null,
          minPrice: pMin || null,
          maxPrice: pMax || null
        }
      }
    });
  } catch (err) { 
    next(err); 
  }
};

exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Try to find by productId first, then by legacy _id
    let product = await Product.findOne({ productId: id });
    if (!product) {
      product = await Product.findById(id);
    }
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (err) { 
    next(err); 
  }
};

// GET /api/products/:id/price?metal=14k_yellow_gold&quantity=1
exports.getPriceForSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { metal, quantity = 1 } = req.query;
    const qty = Math.max(1, Number(quantity) || 1);

    // Try to find by productId first, then by legacy _id
    let product = await Product.findOne({ productId: id });
    if (!product) {
      product = await Product.findById(id);
    }
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const settingPrice = product.default_price || 0;
    const total = settingPrice * qty;
    
    res.json({
      quantity: qty,
      settingPrice,
      total
    });
  } catch (err) { 
    next(err); 
  }
};


