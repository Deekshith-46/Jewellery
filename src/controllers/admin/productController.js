const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Metal = require('../../models/admin/Metal');
const Style = require('../../models/admin/Style');
const Shape = require('../../models/admin/Shape');
require('../../models/admin/Category');
const XLSX = require('xlsx');
const slugify = require('slugify');

exports.createProductByAdmin = async (req, res, next) => {
  try {
    const body = { ...req.body };
    
    // Clean up empty string values for ObjectId fields
    ['categoryId','styleId'].forEach(k => {
      if (body[k] === '') delete body[k];
    });

    // Handle array fields
    if (body.availableMetalTypes && typeof body.availableMetalTypes === 'string') {
      body.availableMetalTypes = body.availableMetalTypes.split(',').map(item => item.trim()).filter(Boolean);
    }
    if (body.availableShapes && typeof body.availableShapes === 'string') {
      body.availableShapes = body.availableShapes.split(',').map(item => item.trim()).filter(Boolean);
    }

    // Handle boolean fields
    if (body.readyToShip !== undefined) {
      body.readyToShip = String(body.readyToShip).toLowerCase() !== 'false';
    }
    if (body.engravingAllowed !== undefined) {
      body.engravingAllowed = String(body.engravingAllowed).toLowerCase() !== 'false';
    }
    if (body.active !== undefined) {
      body.active = String(body.active).toLowerCase() !== 'false';
    }

    // Generate slug if productName is provided
    if (body.productName && !body.slug) {
      body.slug = slugify(body.productName, { lower: true });
    }

    const p = new Product(body);
    await p.save();
    res.status(201).json(p);
  } catch (err) { next(err); }
};

exports.deleteProductByAdmin = async (req, res, next) => {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

// Deactivate a specific product (admin-only)
exports.deactivateProductByAdmin = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await Product.findByIdAndUpdate(id, { active: false }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deactivated', product: doc });
  } catch (err) { next(err); }
};

// Activate a specific product (admin-only)
exports.activateProductByAdmin = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await Product.findByIdAndUpdate(id, { active: true }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Activated', product: doc });
  } catch (err) { next(err); }
};

function norm(str) { return String(str || '').trim(); }
async function resolveRef(Model, queryKeys, value) {
  if (!value) return undefined;
  const v = norm(value);
  if (mongoose.Types.ObjectId.isValid(v)) {
    const doc = await Model.findById(v);
    if (doc) return doc._id;
  }
  const or = [];
  for (const key of queryKeys) {
    or.push({ [key]: new RegExp('^' + v + '$', 'i') });
  }
  const found = await Model.findOne({ $or: or });
  return found ? found._id : undefined;
}

exports.updateProductByAdmin = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const update = { ...req.body };

    // Clean up empty string values for ObjectId fields
    ['categoryId','styleId'].forEach(k => {
      if (update[k] === '') delete update[k];
    });

    // Resolve references
    if (update.style || update.styleId) {
      update.styleId = await resolveRef(Style, ['code','name'], update.style ?? update.styleId) || update.styleId;
      delete update.style;
    }

    // Handle array fields
    if (update.availableMetalTypes && typeof update.availableMetalTypes === 'string') {
      update.availableMetalTypes = update.availableMetalTypes.split(',').map(item => item.trim()).filter(Boolean);
    }
    if (update.availableShapes && typeof update.availableShapes === 'string') {
      update.availableShapes = update.availableShapes.split(',').map(item => item.trim()).filter(Boolean);
    }

    // Handle boolean fields
    if (update.active !== undefined) update.active = String(update.active).toLowerCase() !== 'false';
    if (update.engravingAllowed !== undefined) update.engravingAllowed = String(update.engravingAllowed).toLowerCase() !== 'false';
    if (update.readyToShip !== undefined) update.readyToShip = String(update.readyToShip).toLowerCase() !== 'false';

    // Generate slug if productName is provided
    if (update.productName) update.slug = slugify(update.productName, { lower: true });

    const doc = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
};

// Fast SKU-based bulk upload: maps Excel fields directly, no cloud uploads, minimal transforms
exports.bulkUploadProductsBySku = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Excel file is required' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (sheet.length === 0) return res.status(400).json({ message: 'Excel sheet is empty' });


    const toNumber = (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : undefined;
    };
    const toBoolean = (v, defaultVal) => {
      if (v === '' || v === null || v === undefined) return defaultVal;
      const s = String(v).trim().toLowerCase();
      if (['true','yes','1','y'].includes(s)) return true;
      if (['false','no','0','n'].includes(s)) return false;
      return defaultVal;
    };

    // Build bulk ops
    const ops = [];
    for (let i = 0; i < sheet.length; i++) {
      const r = sheet[i];

      // Map Excel columns to schema fields exactly as specified
      const productSku = r.productSku || '';
      const productName = r.product_name || '';
      // Generate unique slug to avoid conflicts
      let generatedSlug = productName ? slugify(String(productName), { lower: true }) : undefined;
      if (generatedSlug) {
        // Add timestamp suffix to make slug unique
        generatedSlug = `${generatedSlug}-${Date.now()}-${i}`;
      }
      

      // Images mapping - collect default images from Excel columns
      const defaultImages = [
        r.defaultImg_1, r.defaultImg_2
      ].filter(Boolean);

      const variantImages = [r.variant1, r.variant2, r.variant3, r.variant4]
        .filter(Boolean);

      // Handle array fields
      const parseArray = (value) => {
        if (!value) return undefined;
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          return value.split(',').map(item => item.trim()).filter(Boolean);
        }
        return undefined;
      };

      const update = {
        productSku: productSku || undefined,
        productName: productName || undefined,
        slug: generatedSlug,
        description: r.description || undefined,
        categoryId: r.categories || undefined,
        styleId: r.style || undefined,
        stock: toNumber(r.stock) ?? 0,
        metalType: r.metal_type || undefined,
        shape: r.shape || undefined,
        metalWeight: toNumber(r.metal_weight),
        metalCost: toNumber(r.metal_cost),
        metalPrice: toNumber(r.metal_price),
        availability: r.availability || undefined,
        // Image arrays
        defaultImages,
        variantImages,
        // Array fields
        availableMetalTypes: parseArray(r.availableMetalTypes),
        availableShapes: parseArray(r.availableShapes),
        // Boolean fields
        readyToShip: toBoolean(r.readyToShip, false),
        engravingAllowed: toBoolean(r.engravingAllowed, false),
        active: toBoolean(r.active, true)
      };

      // Remove undefined keys
      Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

      // Require at least SKU or productName
      if (!update.productSku && !update.productName) continue;

      // Use productSku if available, otherwise use productName for filtering
      const filter = update.productSku ? { productSku: update.productSku } : { productName: update.productName };

      // Since we're making slugs unique, we can safely update all fields
      ops.push({
        updateOne: {
          filter,
          update: { $set: update },
          upsert: true
        }
      });
    }

    if (!ops.length) return res.status(400).json({ message: 'No valid rows to process' });

    const result = await Product.bulkWrite(ops, { ordered: false });
    const upserts = result.upsertedCount || 0;
    const modified = Object.values(result.nModified ? { nModified: result.nModified } : {}).reduce((a,b)=>a+b, 0) || (result.modifiedCount || 0);
    const matched = result.matchedCount || 0;
    
    return res.status(200).json({ 
      totalRows: sheet.length, 
      processed: ops.length, 
      matched: matched, // Records that were found and updated
      created: upserts, // New records created
      updated: modified, // Records that were modified
      message: `Processed ${ops.length} operations: ${matched} matched, ${upserts} created, ${modified} updated`
    });
  } catch (err) { next(err); }
};
