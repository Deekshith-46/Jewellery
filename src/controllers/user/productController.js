const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Style = require('../../models/admin/Style');
const Shape = require('../../models/admin/Shape');
require('../../models/admin/Category');

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
        { productName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category) {
      filter.categoryId = category;
    }

    // Metal type filter
    const metalFilter = metal_type || metalType;
    if (metalFilter) {
      const metalList = Array.isArray(metalFilter) ? metalFilter : String(metalFilter).split(',').map(s => s.trim()).filter(Boolean);
      if (metalList.length) {
        filter.metalType = { $in: metalList.map(m => new RegExp('^' + m + '$', 'i')) };
      }
    }

    // Style filter
    if (style) {
      const styleList = Array.isArray(style) ? style : String(style).split(',').map(s => s.trim()).filter(Boolean);
      if (styleList.length) {
        // Filter by style string field (since we removed styleId)
        filter.styleId = { $in: styleList.map(s => new RegExp('^' + s + '$', 'i')) };
      }
    }

    // Shape filter
    if (shape) {
      const shapeList = Array.isArray(shape) ? shape : String(shape).split(',').map(s => s.trim()).filter(Boolean);
      if (shapeList.length) {
        filter.shape = { $in: shapeList.map(s => new RegExp('^' + s + '$', 'i')) };
      }
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
      filter.metalPrice = range;
      
      // Debug: Log the filter and test query
      console.log('Price filter range:', range);
      console.log('Final filter:', JSON.stringify(filter, null, 2));
      
      // Test query to see what products exist
      const testQuery = await Product.find({ active: true }).limit(3).select('productName metalPrice');
      console.log('Sample products:', testQuery);
    }

    // Only show active products
    filter.active = true;

    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 20, 100);

    const query = Product.find(filter)
      .populate('categoryId', 'label')
      .populate('styleId', 'name code')
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
          metal_type: metalFilter || null,
          style: style || null,
          shape: shape || null,
          minPrice: pMin || null,
          maxPrice: pMax || null
        }
      }
    });
  } catch (err) { next(err); }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .select('productSku productName description defaultImages variantImages availableMetalTypes availableShapes metalPrice availability stock styleId categoryId slug shape metalType')
      .populate('categoryId', 'label')
      .populate('styleId', 'name code');
    if (!product) return res.status(404).json({ message: 'Not found' });
    res.json(product);
  } catch (err) { next(err); }
};

// GET /api/products/:id/price?metal=14k_yellow_gold&quantity=1
exports.getPriceForSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { metal, quantity = 1 } = req.query;
    const qty = Math.max(1, Number(quantity) || 1);

    const product = await Product.findById(id).select('metalPrice');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const settingPrice = product.metalPrice || 0;
    const total = settingPrice * qty;
    res.json({
      quantity: qty,
      settingPrice,
      total
    });
  } catch (err) { next(err); }
};


