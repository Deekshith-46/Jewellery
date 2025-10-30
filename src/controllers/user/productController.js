const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Variant = require('../../models/admin/Variant');
const Image = require('../../models/admin/Image');

// ===== IMAGE GENERATION HELPER =====
// This function generates 4 image URLs based on product template and selected metal/shape
function fourAnglesFor({ product, sku, metal, shape, cdnBase = process.env.CDN_BASE_URL || 'https://cdn.yoursite.com' }) {
  // Validate metal and shape are allowed for this product
  const allowedMetals = product.metalsExpanded ? product.metalsExpanded.split(',').map(m => m.trim()) : [];
  const allowedShapes = product.shapesExpanded ? product.shapesExpanded.split(',').map(s => s.trim()) : [];
  
  if (allowedMetals.length && !allowedMetals.includes(metal)) return [];
  if (allowedShapes.length && !allowedShapes.includes(shape)) return [];

  // Get angles (default: 001,002,003,004)
  const angles = product.angles ? product.angles.split(',').map(a => a.trim()) : ['001', '002', '003', '004'];
  
  // Get template and base path
  const template = product.filenameTemplate || '{sku}_{shape}_{metal}_{angle}_1600.jpg';
  const base = product.basePath || `rings/${sku}`;

  // Generate 4 URLs
  return angles.map(angle => {
    const filename = template
      .replace('{sku}', sku)
      .replace('{shape}', shape)
      .replace('{metal}', metal)
      .replace('{angle}', angle);
    return `${cdnBase}/${base}/${filename}`;
  });
}

// Get filter options for product listing (metals, shapes, styles, price ranges)
exports.getFilterOptions = async (req, res, next) => {
  try {
    const { tab = 'ready' } = req.query;
    
    let variantFilter = { active: true };
    let productFilter = { active: true };
    
    if (tab === 'ready') {
      variantFilter.stock = { $gt: 0 };
      variantFilter.readyToShip = true;
      productFilter.readyToShip = true;
    } else {
      productFilter.readyToShip = false;
    }
    
    // Get distinct values from variants and products
    const [metals, shapes, styles, variants] = await Promise.all([
      Variant.distinct('metal_type', variantFilter),
      Variant.distinct('shape', variantFilter),
      Product.distinct('style', productFilter),
      Variant.find(variantFilter, 'price').lean()
    ]);
    
    // Calculate price range from variants
    const prices = variants.map(v => v.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    
    // Get categories
    const categoryResults = await Product.find(productFilter, 'categories').lean();
    const allCategories = categoryResults.flatMap(p => p.categories || []);
    const categories = [...new Set(allCategories)];
    
    res.json({
      tab,
      filters: {
        metals: metals.filter(Boolean).sort(),
        shapes: shapes.filter(Boolean).sort(),
        styles: styles.filter(Boolean).sort(),
        categories: categories.filter(Boolean).sort(),
        priceRange: {
          min: Math.floor(minPrice),
          max: Math.ceil(maxPrice)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get product counts for both tabs (lightweight endpoint for badges/stats)
exports.getProductCounts = async (req, res, next) => {
  try {
    // Design count: products with readyToShip=false
    const designCount = await Product.countDocuments({ readyToShip: false, active: true });
    
    // Ready count: products with readyToShip=true
    const readyCount = await Product.countDocuments({ readyToShip: true, active: true });

    res.json({ 
      counts: {
        ready: readyCount,
        design: designCount,
        total: readyCount + designCount
      }
    });
  } catch (err) {
    next(err);
  }
};

// List products by tab (Ready to Ship vs Design Your Own)
exports.listProducts = async (req, res, next) => {
  try {
    const { tab = 'ready', page = 1, limit = 24, search, category, style, shape, metal_type, metalType, minPrice, maxPrice, sort = '-createdAt' } = req.query;
    const skip = (page - 1) * limit;

    let products = [];
    let total = 0;
    let readyCount = 0;
    let designCount = 0;
    
    // Use metal_type or metalType (both accepted for compatibility)
    const metalFilter = metal_type || metalType;

    if (tab === 'design') {
      // Products that are designable (readyToShip=false)
      let productIds = null;
      
      // If filtering by metal_type or shape, find matching variants first
      if (metalFilter || shape) {
        const variantFilter = { active: true };
        if (metalFilter) variantFilter.metal_type = { $regex: metalFilter, $options: 'i' };
        if (shape) variantFilter.shape = { $regex: shape, $options: 'i' };
        
        // Get distinct product ObjectIds that have matching variants
        productIds = await Variant.distinct('product', variantFilter);
      }
      
      const filter = { readyToShip: false, active: true };
      
      // If we have productIds from variant filtering, apply them
      if (productIds !== null) {
        filter._id = { $in: productIds };
      }
      
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

      // Apply price filter (on default_price)
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
      // Ready to ship: products with readyToShip=true
      let productIds = null;
      
      // If filtering by metal_type, shape, or price (variant level), find matching variants first
      if (metalFilter || shape || minPrice || maxPrice) {
        const variantFilter = { active: true, stock: { $gt: 0 } };
        if (metalFilter) variantFilter.metal_type = { $regex: metalFilter, $options: 'i' };
        if (shape) variantFilter.shape = { $regex: shape, $options: 'i' };
        
        // Apply price filter at variant level for ready-to-ship
        if (minPrice || maxPrice) {
          const priceFilter = {};
          if (minPrice) priceFilter.$gte = Number(minPrice);
          if (maxPrice) priceFilter.$lte = Number(maxPrice);
          variantFilter.price = priceFilter;
        }
        
        // Get distinct product ObjectIds that have matching variants
        productIds = await Variant.distinct('product', variantFilter);
      }
      
      const filter = { readyToShip: true, active: true };
      
      // If we have productIds from variant filtering, apply them
      if (productIds !== null) {
        filter._id = { $in: productIds };
      }
      
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

      products = await Product.find(filter)
        .populate('default_images')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

      total = await Product.countDocuments(filter);
    }

    // Calculate counts for both tabs (for frontend tab badges/counts)
    // Design count: products with readyToShip=false
    designCount = await Product.countDocuments({ readyToShip: false, active: true });
    
    // Ready count: products with readyToShip=true
    readyCount = await Product.countDocuments({ readyToShip: true, active: true });

    res.json({ 
      data: products, 
      total, 
      page: Number(page), 
      pages: Math.ceil(total / limit),
      tab,
      counts: {
        ready: readyCount,
        design: designCount,
        total: readyCount + designCount
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get product detail with variants and options
exports.getProductDetail = async (req, res, next) => {
  try {
    const { productId } = req.params;
    
    // Try to find by productSku first, then productId, then _id
    let product = await Product.findOne({ productSku: productId });
    if (!product) {
      product = await Product.findOne({ productId });
    }
    if (!product && mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find variants for this product (using both ObjectId reference and productSku)
    const variants = await Variant.find({ 
      $or: [
        { product: product._id },
        { productSku: product.productSku || product.productId }
      ],
      active: true 
    })
    .populate('product', 'productSku productName title')
    .sort({ createdAt: 1 }); // Sort by creation order (Excel sheet order)
    
    // Find images for this product and its variants
    const images = await Image.find({ 
      $or: [
        { product: product._id },
        { productSku: product.productSku || product.productId }
      ]
    })
    .populate('product', 'productSku productName')
    .populate('variant', 'variant_sku metal_type shape')
    .sort({ sort_order: 1 });

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

// NEW: Get generated images for DYO (Design Your Own) - user selects metal + shape
// GET /api/products/:id/images?metal=14Y&shape=RND
exports.getImagesForSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { metal, shape } = req.query;

    if (!metal || !shape) {
      return res.status(400).json({ message: 'Both metal and shape codes are required' });
    }

    // Find product by productSku or productId
    let product = await Product.findOne({ productSku: id });
    if (!product) {
      product = await Product.findOne({ productId: id });
    }
    if (!product && mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Generate 4 image URLs
    const images = fourAnglesFor({ 
      product, 
      sku: product.productSku || product.productId, 
      metal, 
      shape 
    });

    if (images.length === 0) {
      return res.status(400).json({ 
        message: 'Invalid metal or shape selection for this product',
        allowedMetals: product.metalsExpanded?.split(','),
        allowedShapes: product.shapesExpanded?.split(',')
      });
    }

    res.json({ 
      productSku: product.productSku || product.productId,
      metal,
      shape,
      images 
    });
  } catch (err) { 
    next(err); 
  }
};

// NEW: Get images for RTS (Ready To Ship) variant - metal/shape from variant
// GET /api/products/:productId/variants/:variantSku/images
exports.getImagesForVariant = async (req, res, next) => {
  try {
    const { productId, variantSku } = req.params;

    // Find product
    let product = await Product.findOne({ productSku: productId });
    if (!product) {
      product = await Product.findOne({ productId: productId });
    }
    if (!product && mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Find variant (using both ObjectId reference and productSku)
    const variant = await Variant.findOne({ 
      variant_sku: variantSku,
      $or: [
        { product: product._id },
        { productSku: product.productSku || product.productId }
      ]
    }).populate('product', 'productSku productName');
    
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    // Use variant's metal_code and shape_code
    const metal = variant.metal_code;
    const shape = variant.shape_code;

    if (!metal || !shape) {
      return res.status(400).json({ message: 'Variant missing metal_code or shape_code' });
    }

    // Generate 4 image URLs
    const images = fourAnglesFor({ 
      product, 
      sku: product.productSku || product.productId, 
      metal, 
      shape 
    });

    res.json({ 
      productSku: product.productSku || product.productId,
      variantSku: variant.variant_sku,
      metal,
      shape,
      metalType: variant.metal_type,
      shapeType: variant.shape,
      images 
    });
  } catch (err) { 
    next(err); 
  }
};


