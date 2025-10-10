const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Metal = require('../../models/admin/Metal');
const Style = require('../../models/admin/Style');
const Gemstone = require('../../models/admin/Gemstone');
const Shape = require('../../models/admin/Shape');
const Size = require('../../models/admin/Size');
require('../../models/admin/Category');

exports.getAllProducts = async (req, res, next) => {
  try {
    try { console.log('Registered mongoose models:', Object.keys(require('mongoose').models)); } catch (e) {}
    const { page = 1, limit = 20, search, category, metal, metals, style, styles, gemstone, shape, shapes, size, minPrice, maxPrice, priceMin, priceMax, sort = '-createdAt' } = req.query;
    const filter = {};
    if (search) filter.$text = { $search: search };
    if (category) filter.categoryId = category;

    const toList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => s.trim()).filter(Boolean);
    const normCode = (s) => String(s || '').trim().toLowerCase().replace(/[\-\s]+/g, '_');

    if (metals || metal) {
      const list = toList(metals ?? metal);
      const ids = [];
      const nameOrCodes = [];
      for (const m of list) {
        if (mongoose.Types.ObjectId.isValid(m)) ids.push(m);
        else {
          nameOrCodes.push(m);
          const normalized = normCode(m);
          if (normalized !== m) nameOrCodes.push(normalized);
        }
      }
      const orConds = [];
      if (nameOrCodes.length) {
        const exactList = nameOrCodes.map(n => new RegExp('^' + n + '$', 'i'));
        orConds.push({ code: { $in: exactList } });
        orConds.push({ name: { $in: exactList } });
      }
      const byNames = orConds.length ? await Metal.find({ $or: orConds }).select('_id') : [];
      const metalIds = [...ids, ...byNames.map(x => x._id)];
      if (metalIds.length) filter.metalId = { $in: metalIds };
    }

    if (styles || style) {
      const list = toList(styles ?? style);
      const ids = [];
      const nameOrCodes = [];
      for (const s of list) {
        if (mongoose.Types.ObjectId.isValid(s)) ids.push(s); else nameOrCodes.push(s);
      }
      const orConds = nameOrCodes.length ? [
        { code: { $in: nameOrCodes.map(n => new RegExp('^' + n + '$', 'i')) } },
        { name: { $in: nameOrCodes.map(n => new RegExp('^' + n + '$', 'i')) } }
      ] : [];
      const byNames = orConds.length ? await Style.find({ $or: orConds }).select('_id') : [];
      const styleIds = [...ids, ...byNames.map(x => x._id)];
      if (styleIds.length) filter.styleId = { $in: styleIds };
    }

    if (shapes || shape) {
      const list = toList(shapes ?? shape);
      const ids = [];
      const nameOrCodes = [];
      for (const sh of list) {
        if (mongoose.Types.ObjectId.isValid(sh)) ids.push(sh); else nameOrCodes.push(sh);
      }
      const orConds = nameOrCodes.length ? [
        { code: { $in: nameOrCodes.map(n => new RegExp('^' + n + '$', 'i')) } },
        { label: { $in: nameOrCodes.map(n => new RegExp('^' + n + '$', 'i')) } }
      ] : [];
      const byNames = orConds.length ? await Shape.find({ $or: orConds }).select('_id') : [];
      const shapeIds = [...ids, ...byNames.map(x => x._id)];
      if (shapeIds.length) filter.shapeId = { $in: shapeIds };
    }

    if (gemstone) {
      if (mongoose.Types.ObjectId.isValid(gemstone)) {
        filter.gemstoneId = gemstone;
      } else {
        const g = await Gemstone.findOne({ code: new RegExp('^' + gemstone + '$', 'i') });
        if (g) filter.gemstoneId = g._id;
      }
    }

    if (size) {
      if (mongoose.Types.ObjectId.isValid(size)) {
        filter.sizeId = size;
      } else {
        const val = Number(size);
        if (!Number.isNaN(val)) {
          const sz = await Size.findOne({ value: val });
          if (sz) filter.sizeId = sz._id;
        }
      }
    }

    const pMinRaw = priceMin ?? minPrice;
    const pMaxRaw = priceMax ?? maxPrice;
    const pMin = pMinRaw !== undefined && pMinRaw !== '' ? Number(pMinRaw) : undefined;
    const pMax = pMaxRaw !== undefined && pMaxRaw !== '' ? Number(pMaxRaw) : undefined;
    if ((pMin !== undefined && !Number.isNaN(pMin)) || (pMax !== undefined && !Number.isNaN(pMax))) {
      const range = {};
      if (pMin !== undefined && !Number.isNaN(pMin)) range.$gte = pMin;
      if (pMax !== undefined && !Number.isNaN(pMax)) range.$lte = pMax;
      const priceOr = [];
      priceOr.push({ basePrice: range });
      priceOr.push({ metalPrice: range });
      if (filter.$or) filter.$or = filter.$or.concat(priceOr); else filter.$or = priceOr;
    }

    filter.active = true;

    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 20, 100);

    const query = Product.find(filter)
      .populate('categoryId', 'label')
      .populate('metalId', 'name code')
      .populate('styleId', 'name code')
      .populate('shapeId', 'code label')
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(Number(limitNum));

    const [items, total] = await Promise.all([query.exec(), Product.countDocuments(filter)]);
    res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) { next(err); }
};

exports.getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('categoryId')
      .populate('diamondSpecId');
    if (!product) return res.status(404).json({ message: 'Not found' });
    res.json(product);
  } catch (err) { next(err); }
};

// GET /api/products/:id/price?metalId=...&shapeId=...&diamondId=...&quantity=1
exports.getPriceForSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { metalId, shapeId, diamondId, diamondPrice: diamondPriceRaw, quantity = 1 } = req.query;
    const qty = Math.max(1, Number(quantity) || 1);

    const product = await Product.findById(id).select('basePrice metalPrice');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Metal and shape can be validated if you need; for pricing we only need product.metalPrice.
    // Optionally you can verify metalId/shapeId exist; skipping heavy checks for speed.

    let diamondPrice = 0;
    const DiamondSpec = require('../../models/admin/DiamondSpec');
    const chosenDiamondId = diamondId || (product.diamondSpecId ? String(product.diamondSpecId) : null);
    if (chosenDiamondId) {
      const diamond = await DiamondSpec.findById(chosenDiamondId).select('price');
      if (!diamond && diamondId) return res.status(400).json({ message: 'Diamond not found' });
      if (diamond) diamondPrice = diamond.price || 0;
    } else if (diamondPriceRaw !== undefined) {
      const dp = Number(diamondPriceRaw);
      if (!Number.isNaN(dp)) diamondPrice = dp;
    }

    const base = (product.basePrice || 0) + (product.metalPrice || 0) + diamondPrice;
    const total = base * qty;
    res.json({
      quantity: qty,
      breakdown: {
        productBase: product.basePrice || 0,
        metalPrice: product.metalPrice || 0,
        diamondPrice
      },
      total
    });
  } catch (err) { next(err); }
};

