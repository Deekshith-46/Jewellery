const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Variant = require('../../models/admin/Variant');
const Image = require('../../models/admin/Image');
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

// ===== COMPREHENSIVE BULK UPLOAD: Processes ALL 5 Sheets =====
// Sheets: Products, Variants, Images, Metals, Lookups
exports.bulkUploadProductsBySku = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Excel file is required' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = wb.SheetNames;

    // Helper functions
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
      const parseArray = (value) => {
        if (!value) return undefined;
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          return value.split(',').map(item => item.trim()).filter(Boolean);
        }
        return undefined;
      };

    const results = {
      products: { processed: 0, created: 0, updated: 0, matched: 0 },
      variants: { processed: 0, created: 0, updated: 0, matched: 0 },
      images: { processed: 0, created: 0, updated: 0, matched: 0 },
      metals: { processed: 0, created: 0, updated: 0, matched: 0 }
    };

    // ===== 1. PROCESS PRODUCTS SHEET =====
    const productsSheetName = sheetNames.find(n => n.toLowerCase().includes('product')) || sheetNames[0];
    if (productsSheetName) {
      // 🔧 NEW APPROACH: Read as array of arrays
      const productsSheet = wb.Sheets[productsSheetName];
      const rawData = XLSX.utils.sheet_to_json(productsSheet, { header: 1, defval: '' });
      
      console.log(`\n📊 PRODUCTS SHEET - Reading as raw array...`);
      console.log(`Total rows including header: ${rawData.length}`);
      
      let productsData = [];
      if (rawData.length >= 2) {
        const headers = rawData[0];
        console.log(`📋 Header row (first 15):`, headers.slice(0, 15));
        
        const colMap = {};
        headers.forEach((header, index) => {
          const cleanHeader = String(header || '').trim().toLowerCase().replace(/_/g, '');
          if (cleanHeader) {
            colMap[cleanHeader] = index;
            // Also store original case version
            const originalClean = String(header || '').trim();
            if (originalClean) {
              colMap[originalClean] = index;
            }
          }
        });
        
        // Helper to get value from row using multiple possible column names
        const getValue = (row, ...possibleNames) => {
          for (const name of possibleNames) {
            const idx = colMap[name] || colMap[name.toLowerCase()] || colMap[name.toLowerCase().replace(/_/g, '')];
            if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
              return row[idx];
            }
          }
          return '';
        };
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          const obj = {
            productSku: getValue(row, 'productSku', 'product_sku', 'productsku'),
            product_name: getValue(row, 'product_name', 'productName', 'productname'),
            description: getValue(row, 'description'),
            categories: getValue(row, 'categories'),
            style: getValue(row, 'style'),
            main_shape: getValue(row, 'main_shape', 'mainShape', 'mainshape'),
            readyToShip: getValue(row, 'readyToShip', 'ready_to_ship', 'readytoship'),
            default_price: getValue(row, 'default_price', 'defaultPrice', 'defaultprice'),
            engravingAllowed: getValue(row, 'engravingAllowed', 'engraving_allowed', 'engravingallowed'),
            use_all_metals: getValue(row, 'use_all_metals', 'useAllMetals', 'useallmetals'),
            availableMetalTypes: getValue(row, 'availableMetalTypes', 'available_metal_types', 'availablemetaltypes'),
            use_all_shapes: getValue(row, 'use_all_shapes', 'useAllShapes', 'useallshapes'),
            availableShapes: getValue(row, 'availableShapes', 'available_shapes', 'availableshapes'),
            angles: getValue(row, 'angles'),
            basePath: getValue(row, 'basePath', 'base_path', 'basepath'),
            filenameTemplate: getValue(row, 'filenameTemplate', 'filename_template', 'filenametemplate'),
            metalsExpanded: getValue(row, 'metalsExpanded', 'metals_expanded', 'metalsexpanded'),
            shapesExpanded: getValue(row, 'shapesExpanded', 'shapes_expanded', 'shapesexpanded')
          };
          
          if (obj.productSku || obj.product_name) {
            productsData.push(obj);
          }
        }
        
        console.log(`✅ Parsed ${productsData.length} product rows from Excel`);
      }
      
      const productOps = [];
      for (let i = 0; i < productsData.length; i++) {
        const r = productsData[i];
        const productSku = r.productSku || '';
        const productName = r.product_name || '';
        
        if (!productSku && !productName) continue;

        // Generate productId and slug ONLY for new products (will be set on insert only)
        const productId = productSku ? productSku.toLowerCase().replace(/[^a-z0-9-]/g, '-') : `product-${Date.now()}-${i}`;
        const title = productName || productSku;
        const slug = slugify(title, { lower: true }) + `-${Date.now()}-${i}`;

        // Fields to update on every upload
        const update = {
          productSku: productSku || undefined,
          productName: productName || undefined,
          title: title,
          description: r.description || undefined,
          categories: parseArray(r.categories),
          style: r.style || undefined,
          main_shape: r.main_shape || undefined,
          readyToShip: toBoolean(r.readyToShip, false),
          default_price: toNumber(r.default_price),
          engravingAllowed: toBoolean(r.engravingAllowed, false),
          active: toBoolean(r.active, true),
          
          // NEW: 9 Image Generation Fields
          useAllMetals: toBoolean(r.use_all_metals, true),
          availableMetalTypes: parseArray(r.availableMetalTypes),
          useAllShapes: toBoolean(r.use_all_shapes, true),
          availableShapes: parseArray(r.availableShapes),
          angles: r.angles || '001,002,003,004',
          basePath: r.basePath || `rings/${productSku}`,
          filenameTemplate: r.filenameTemplate || '{sku}_{shape}_{metal}_{angle}_1600.jpg',
          metalsExpanded: r.metalsExpanded || undefined,
          shapesExpanded: r.shapesExpanded || undefined
        };

        // Fields to set ONLY on insert (first time)
        const setOnInsert = {
          productId: productId,
          slug: slug,
          createdAt: new Date()
        };

        // Remove undefined keys
        Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

        productOps.push({
          updateOne: {
            filter: { productSku: productSku },
            update: { 
              $set: update,
              $setOnInsert: setOnInsert
            },
            upsert: true
          }
        });
      }

      if (productOps.length) {
        const result = await Product.bulkWrite(productOps, { ordered: false });
        results.products.processed = productOps.length;
        results.products.created = result.upsertedCount || 0;
        results.products.matched = result.matchedCount || 0;
        results.products.updated = result.modifiedCount || 0;
      }
    }

    // ===== 2. PROCESS VARIANTS SHEET =====
    const variantsSheetName = sheetNames.find(n => n.toLowerCase().includes('variant'));
    if (variantsSheetName) {
      // 🔧 NEW APPROACH: Read as array of arrays to avoid column mismatch issues
      const variantsSheet = wb.Sheets[variantsSheetName];
      const rawData = XLSX.utils.sheet_to_json(variantsSheet, { header: 1, defval: '' });
      
      console.log(`\n📊 VARIANTS SHEET - Reading as raw array...`);
      console.log(`Total rows including header: ${rawData.length}`);
      
      if (rawData.length < 2) {
        console.log(`⚠️  Variants sheet is empty or has no data rows`);
      } else {
        // First row is the header
        const headers = rawData[0];
        console.log(`\n📋 Header row (all columns):`, headers);
        
        // Find column indices for each field
        const colMap = {};
        headers.forEach((header, index) => {
          const cleanHeader = String(header || '').trim().toLowerCase();
          if (cleanHeader) {
            colMap[cleanHeader] = index;
          }
        });
        
        console.log(`\n🗺️  Column mapping:`, colMap);
        
        // Convert array data to objects using the column mapping
        let variantsData = [];
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          const obj = {
            productSku: row[colMap['productsku']] || row[colMap['product_sku']] || '',
            variant_sku: row[colMap['variant_sku']] || '',
            metal_type: row[colMap['metal_type']] || '',
            carat: row[colMap['carat']] || '',
            shape: row[colMap['shape']] || '',
            diamond_type: row[colMap['diamond_type']] || '',
            price: row[colMap['price']] || '',
            weight_metal: row[colMap['weight_metal']] || '',
            metal_cost: row[colMap['metal_cost']] || '',
            stock: row[colMap['stock']] || '',
            readyToShip: row[colMap['readytoship']] || row[colMap['readyToShip']] || '',
            active: row[colMap['active']] || '',
            metal_code: row[colMap['metal_code']] || '',
            shape_code: row[colMap['shape_code']] || ''
          };
          
          // Only add row if it has essential data
          if (obj.productSku || obj.variant_sku) {
            variantsData.push(obj);
          }
        }
        
        console.log(`\n✅ Parsed ${variantsData.length} variant rows from Excel`);
        console.log(`First 3 variants:`, JSON.stringify(variantsData.slice(0, 3), null, 2));
        
        // Find RING-001 rows
        const ring001Rows = variantsData.filter(r => r.productSku === 'RING-001');
        console.log(`\n🔍 RING-001 rows found: ${ring001Rows.length}`);
        if (ring001Rows.length > 0) {
          console.log(`RING-001 variants:`, JSON.stringify(ring001Rows, null, 2));
        }
      
      // PERFORMANCE: Cache all products in memory for fast lookup
      const allProducts = await Product.find({});
      const productMap = new Map();
      allProducts.forEach(p => {
        if (p.productSku) productMap.set(p.productSku, p);
        if (p.productId) productMap.set(p.productId, p);
      });
      console.log(`📦 Loaded ${productMap.size} products into cache for variants`);
      
      const variantOps = [];
      let skippedCount = 0;
      for (const r of variantsData) {
        const variantSku = r.variant_sku || '';
        const productSku = r.productSku || '';
        
        if (!variantSku || !productSku) {
          skippedCount++;
          console.log(`⚠️  Skipped row (missing variant_sku or productSku):`, r);
          continue;
        }

        // Fast lookup from cache
        const product = productMap.get(productSku);
        if (!product) {
          console.log(`⚠️  Product not found for variant ${variantSku}: ${productSku}`);
          continue;
        }

        // Fields to update on every upload
        const update = {
          product: product._id, // ObjectId reference
          productSku: productSku,
          variant_sku: variantSku,
          metal_type: r.metal_type || undefined,
          metal_code: r.metal_code || undefined,
          carat: toNumber(r.carat),
          shape: r.shape || undefined,
          shape_code: r.shape_code || undefined,
          diamond_type: r.diamond_type || undefined,
          price: toNumber(r.price),
          weight_metal: toNumber(r.weight_metal),
          metal_cost: toNumber(r.metal_cost),
          stock: toNumber(r.stock) ?? 0,
          readyToShip: toBoolean(r.readyToShip, true),
          active: toBoolean(r.active, true)
        };

        // Fields to set ONLY on insert (first time)
        const setOnInsert = {
          createdAt: new Date()
        };

        Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

        // DEBUG: Log RING-001 variants specifically
        if (productSku === 'RING-001') {
          console.log(`\n✅ Processing RING-001 variant:`, {
            variant_sku: variantSku,
            metal_type: update.metal_type,
            shape: update.shape,
            carat: update.carat,
            raw_row: r
          });
        }

        variantOps.push({
          updateOne: {
            filter: { variant_sku: variantSku },
            update: { 
              $set: update,
              $setOnInsert: setOnInsert
            },
            upsert: true
          }
        });
      }
      
      console.log(`\n📊 Variants processing summary: ${variantOps.length} operations, ${skippedCount} skipped`);

      if (variantOps.length) {
        try {
          const result = await Variant.bulkWrite(variantOps, { ordered: false });
          results.variants.processed = variantOps.length;
          results.variants.created = result.upsertedCount || 0;
          results.variants.matched = result.matchedCount || 0;
          results.variants.updated = result.modifiedCount || 0;
          console.log(`\n✅ Variants bulkWrite result:`, {
            upsertedCount: result.upsertedCount,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            hasWriteErrors: result.hasWriteErrors ? result.hasWriteErrors() : false
          });
          
          // Check for write errors
          if (result.hasWriteErrors && result.hasWriteErrors()) {
            console.error(`\n❌ Variant write errors:`, result.getWriteErrors());
          }
        } catch (err) {
          console.error(`\n❌ Variants bulkWrite error:`, err.message);
          if (err.writeErrors) {
            console.error(`Write errors:`, err.writeErrors);
          }
          throw err;
        }
      }
      } // End of else block for rawData.length >= 2
    }

    // ===== 3. PROCESS IMAGES SHEET =====
    const imagesSheetName = sheetNames.find(n => n.toLowerCase().includes('image'));
    if (imagesSheetName) {
      // 🔧 NEW APPROACH: Read as array of arrays
      const imagesSheet = wb.Sheets[imagesSheetName];
      const rawData = XLSX.utils.sheet_to_json(imagesSheet, { header: 1, defval: '' });
      
      console.log(`\n📊 IMAGES SHEET - Reading as raw array...`);
      console.log(`Total rows including header: ${rawData.length}`);
      
      let imagesData = [];
      if (rawData.length >= 2) {
        const headers = rawData[0];
        console.log(`📋 Header row:`, headers);
        
        const colMap = {};
        headers.forEach((header, index) => {
          const cleanHeader = String(header || '').trim().toLowerCase();
          if (cleanHeader) {
            colMap[cleanHeader] = index;
          }
        });
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          const obj = {
            productSku: row[colMap['productsku']] || row[colMap['product_sku']] || '',
            variant_sku: row[colMap['variant_sku']] || '',
            image_url_1: row[colMap['image_url_1']] || row[colMap['imageurl1']] || '',
            image_url_2: row[colMap['image_url_2']] || row[colMap['imageurl2']] || '',
            alt_text: row[colMap['alt_text']] || '',
            sort_order: row[colMap['sort_order']] || '',
            active: row[colMap['active']] || ''
          };
          
          // Only add if at least one image URL exists
          if (obj.image_url_1 || obj.image_url_2) {
            imagesData.push(obj);
          }
        }
        
        console.log(`✅ Parsed ${imagesData.length} image rows from Excel`);
      }
      
      // PERFORMANCE: Cache all products and variants in memory
      const allProducts = await Product.find({});
      const productMap = new Map();
      allProducts.forEach(p => {
        if (p.productSku) productMap.set(p.productSku, p);
        if (p.productId) productMap.set(p.productId, p);
      });
      
      const allVariants = await Variant.find({});
      const variantMap = new Map();
      allVariants.forEach(v => {
        if (v.variant_sku) variantMap.set(v.variant_sku, v);
      });
      console.log(`📦 Loaded ${productMap.size} products and ${variantMap.size} variants into cache for images`);
      
      const imageOps = [];
      for (const r of imagesData) {
        const productSku = r.productSku || r.product_sku || '';
        const variantSku = r.variant_sku || '';
        const imageUrl1 = r.image_url_1 || '';
        const imageUrl2 = r.image_url_2 || '';
        
        // Skip if no image URLs or no product reference
        if ((!imageUrl1 && !imageUrl2) || (!productSku && !variantSku)) continue;

        // Fast lookup from cache
        let productId = undefined;
        if (productSku) {
          const product = productMap.get(productSku);
          if (product) {
            productId = product._id;
          } else {
            console.log(`⚠️  Product not found for image: ${productSku}`);
          }
        }

        // Fast lookup from cache
        let variantId = undefined;
        if (variantSku) {
          const variant = variantMap.get(variantSku);
          if (variant) {
            variantId = variant._id;
          } else {
            console.log(`⚠️  Variant not found for image: ${variantSku}`);
          }
        }

        // Fields to update on every upload
        const update = {
          product: productId || undefined, // ObjectId reference
          productSku: productSku || undefined,
          variant: variantId || undefined, // ObjectId reference
          variant_sku: variantSku || undefined,
          image_url_1: imageUrl1 || undefined,
          image_url_2: imageUrl2 || undefined,
          alt_text: r.alt_text || `${productSku || variantSku} Image`,
          sort_order: toNumber(r.sort_order) || 0,
          active: toBoolean(r.active, true)
        };

        // Fields to set ONLY on insert (first time)
        const setOnInsert = {
          createdAt: new Date()
        };

        Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

        // Build unique filter: productSku + variant_sku (or null) + sort_order
        // This ensures we update the same image record on re-upload
        const filter = { 
          productSku: productSku,
          variant_sku: variantSku || null,
          sort_order: toNumber(r.sort_order) || 0
        };

        imageOps.push({
          updateOne: {
            filter,
            update: { 
              $set: update,
              $setOnInsert: setOnInsert
            },
            upsert: true
          }
        });
    }

      if (imageOps.length) {
        const result = await Image.bulkWrite(imageOps, { ordered: false });
        results.images.processed = imageOps.length;
        results.images.created = result.upsertedCount || 0;
        results.images.matched = result.matchedCount || 0;
        results.images.updated = result.modifiedCount || 0;
      }
    }

    // ===== 4. PROCESS METALS SHEET =====
    const metalsSheetName = sheetNames.find(n => n.toLowerCase().includes('metal'));
    if (metalsSheetName) {
      // 🔧 NEW APPROACH: Read as array of arrays
      const metalsSheet = wb.Sheets[metalsSheetName];
      const rawData = XLSX.utils.sheet_to_json(metalsSheet, { header: 1, defval: '' });
      
      console.log(`\n📊 METALS SHEET - Reading as raw array...`);
      console.log(`Total rows including header: ${rawData.length}`);
      
      let metalsData = [];
      if (rawData.length >= 2) {
        const headers = rawData[0];
        console.log(`📋 Header row:`, headers);
        
        const colMap = {};
        headers.forEach((header, index) => {
          const cleanHeader = String(header || '').trim().toLowerCase();
          if (cleanHeader) {
            colMap[cleanHeader] = index;
          }
        });
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          const obj = {
            metal_type: row[colMap['metal_type']] || row[colMap['metaltype']] || '',
            metal_code: row[colMap['metal_code']] || row[colMap['metalcode']] || '',
            rate_per_gram: row[colMap['rate_per_gram']] || row[colMap['ratepergram']] || row[colMap['price_per_gram']] || row[colMap['pricepergram']] || '',
            price_multiplier: row[colMap['price_multiplier']] || row[colMap['pricemultiplier']] || '',
            active: row[colMap['active']] || ''
          };
          
          if (obj.metal_type) {
            metalsData.push(obj);
          }
        }
        
        console.log(`✅ Parsed ${metalsData.length} metal rows from Excel`);
        console.log(`First 3 metals:`, metalsData.slice(0, 3));
      }
      
      const metalOps = [];
      for (const r of metalsData) {
        const metalType = r.metal_type || '';
        
        if (!metalType) continue;

        // Fields to update on every upload
        const update = {
          metal_type: metalType,
          metal_code: r.metal_code || undefined,
          rate_per_gram: toNumber(r.rate_per_gram) || 0,
          price_multiplier: toNumber(r.price_multiplier) || 1,
          active: toBoolean(r.active, true)
        };

        // Fields to set ONLY on insert (first time)
        const setOnInsert = {
          createdAt: new Date()
        };

        Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

        console.log(`Processing metal: ${metalType}, rate_per_gram: ${update.rate_per_gram}, multiplier: ${update.price_multiplier}`);

        metalOps.push({
          updateOne: {
            filter: { metal_type: metalType },
            update: { 
              $set: update,
              $setOnInsert: setOnInsert
            },
            upsert: true
          }
        });
      }

      if (metalOps.length) {
        const result = await Metal.bulkWrite(metalOps, { ordered: false });
        results.metals.processed = metalOps.length;
        results.metals.created = result.upsertedCount || 0;
        results.metals.matched = result.matchedCount || 0;
        results.metals.updated = result.modifiedCount || 0;
      }
    }

    // ===== 5. LOOKUPS SHEET (Optional - for reference only) =====
    // Lookups sheet is typically used for Excel formulas and mapping, not for database storage
    
    // Build summary message
    const summaryParts = [];
    if (results.products.processed > 0) {
      summaryParts.push(`Products: ${results.products.created} created, ${results.products.updated} updated`);
    }
    if (results.variants.processed > 0) {
      summaryParts.push(`Variants: ${results.variants.created} created, ${results.variants.updated} updated`);
    }
    if (results.images.processed > 0) {
      summaryParts.push(`Images: ${results.images.created} created, ${results.images.updated} updated`);
    }
    if (results.metals.processed > 0) {
      summaryParts.push(`Metals: ${results.metals.created} created, ${results.metals.updated} updated`);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Bulk upload completed successfully. Re-uploading the same file will update existing records instead of creating duplicates.',
      results: {
        products: {
          processed: results.products.processed,
          created: results.products.created,
          updated: results.products.updated,
          matched: results.products.matched
        },
        variants: {
          processed: results.variants.processed,
          created: results.variants.created,
          updated: results.variants.updated,
          matched: results.variants.matched
        },
        images: {
          processed: results.images.processed,
          created: results.images.created,
          updated: results.images.updated,
          matched: results.images.matched
        },
        metals: {
          processed: results.metals.processed,
          created: results.metals.created,
          updated: results.metals.updated,
          matched: results.metals.matched
        }
      },
      summary: summaryParts.join(' | ')
    });
  } catch (err) { 
    console.error('Bulk upload error:', err);
    next(err); 
  }
};
