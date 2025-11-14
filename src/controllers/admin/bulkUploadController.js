const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Product = require('../../models/admin/Product');
const ExpandedVariant = require('../../models/admin/ExpandedVariant');
const DYOExpandedVariant = require('../../models/admin/DYOExpandedVariant');
const Metal = require('../../models/admin/Metal');
const VariantSummary = require('../../models/admin/VariantSummary');

/**
 * Fast bulk upload - processes all 4 sheets from Excel
 * POST /api/admin/products/bulk-upload
 * 
 * Sheets processed:
 * 1. Products - productSku, productName, description, categories, style, defaultShape, defaultMetalWeight, defaultPrice, imageUrl1, imageUrl2, readyToShip
 * 2. ExpandedVariants - productSku, variantSku, metalType, metalCode, shape_code, metalWeight, metalBasePrice, metalPrice, stock, active
 * 3. DYOExpandedVariants - productSku, variantSku, productName, metalType, metalCode, shape_code, metalWeight, metalBasePrice, metalPrice, readyToShip, active
 * 4. Metals - metal_type, rate_per_gram, price_multiplier, metal_code
 */
exports.bulkUploadProducts = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Excel file is required' 
      });
    }

    // Read Excel file
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetNames = wb.SheetNames;

    // Helper functions
    const toNumber = (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
      return Number.isFinite(n) ? n : undefined;
    };

    const toBoolean = (v, defaultVal = false) => {
      if (v === '' || v === null || v === undefined) return defaultVal;
      const s = String(v).trim().toUpperCase();
      if (['TRUE', 'YES', '1', 'Y'].includes(s)) return true;
      if (['FALSE', 'NO', '0', 'N'].includes(s)) return false;
      return defaultVal;
    };

    const normalizeString = (v) => {
      if (v === null || v === undefined) return undefined;
      const s = String(v).trim();
      return s === '' ? undefined : s;
    };

    const toArrayOfStrings = (v) => {
      if (v === undefined || v === null || v === '') return [];
      if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
      return String(v).split(',').map(x => x.trim()).filter(Boolean);
    };

    const toArrayOfNumbers = (v) => {
      if (v === undefined || v === null || v === '') return [];
      const arr = Array.isArray(v) ? v : String(v).split(',');
      return arr.map(x => {
        const n = toNumber(x);
        return n === undefined ? null : n;
      }).filter(x => x !== null);
    };

  // Results tracking
    const results = {
    products: { processed: 0, created: 0, updated: 0 },
    variantSummaries: { processed: 0, created: 0, updated: 0 },
    expandedVariants: { processed: 0, created: 0, updated: 0 },
    dyoExpandedVariants: { processed: 0, created: 0, updated: 0 },
      dyoVariants: { processed: 0, created: 0, updated: 0 },
    metals: { processed: 0, created: 0, updated: 0 }
  };

    // ===== 1. PROCESS METALS SHEET (First - needed for variants) =====
    const metalsSheetName = sheetNames.find(n => n.toLowerCase() === 'metals');
    if (metalsSheetName) {
      const metalsSheet = wb.Sheets[metalsSheetName];
      const rawData = XLSX.utils.sheet_to_json(metalsSheet, { header: 1, defval: '' });
      
      if (rawData.length >= 2) {
        const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
        const metalOps = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.length === 0) continue;

          const getValue = (colName) => {
            const idx = headers.findIndex(h => h === colName.toLowerCase());
            return idx >= 0 && row[idx] !== undefined ? normalizeString(row[idx]) : undefined;
          };

          const metal_type = getValue('metal_type');
          if (!metal_type) continue;

          const update = {
            metal_type: metal_type,
            metal_code: getValue('metal_code'),
            rate_per_gram: toNumber(getValue('rate_per_gram')),
            price_multiplier: toNumber(getValue('price_multiplier')) || 1
          };

          Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

          if (update.rate_per_gram === undefined) continue;

          metalOps.push({
            updateOne: {
              filter: { metal_type: metal_type },
              update: { $set: update },
              upsert: true
            }
          });
        }

        if (metalOps.length > 0) {
          const result = await Metal.bulkWrite(metalOps, { ordered: false });
          results.metals.processed = metalOps.length;
          results.metals.created = result.upsertedCount || 0;
          results.metals.updated = result.modifiedCount || 0;
        }
      }
    }

    // ===== 2. PROCESS PRODUCTS SHEET =====
    const productsSheetName = sheetNames.find(n => n.toLowerCase() === 'products');
    if (productsSheetName) {
      const productsSheet = wb.Sheets[productsSheetName];
      const rawData = XLSX.utils.sheet_to_json(productsSheet, { header: 1, defval: '' });
      
      if (rawData.length >= 2) {
        const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
        const productOps = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.length === 0) continue;

          const getValue = (colName) => {
            const idx = headers.findIndex(h => h === colName.toLowerCase());
            return idx >= 0 && row[idx] !== undefined ? normalizeString(row[idx]) : undefined;
          };

          const productSku = getValue('productsku');
          if (!productSku) continue;

          // Parse delivery_date if it's a date string
          const parseDate = (dateStr) => {
            if (!dateStr) return undefined;
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? undefined : date;
          };

          const update = {
            productSku: productSku,
            productName: getValue('productname'),
            description: getValue('description'),
            categories: getValue('categories'),
            style: getValue('style'),
            defaultShape: getValue('defaultshape'),
            defaultMetalWeight: toNumber(getValue('defaultmetalweight')),
            defaultPrice: toNumber(getValue('defaultprice')),
            imageUrl1: getValue('imageurl1'),
            imageUrl2: getValue('imageurl2'),
            readyToShip: toBoolean(getValue('readytoship'), false),
            engravingAllowed: toBoolean(getValue('engravingallowed'), false),
            active: toBoolean(getValue('active'), true),
            lead_days: toNumber(getValue('lead_days')),
            delivery_date: parseDate(getValue('delivery_date'))
          };

          Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

          productOps.push({
            updateOne: {
              filter: { productSku: productSku },
              update: { $set: update },
              upsert: true
            }
          });
        }

        if (productOps.length > 0) {
          const result = await Product.bulkWrite(productOps, { ordered: false });
          results.products.processed = productOps.length;
          results.products.created = result.upsertedCount || 0;
          results.products.updated = result.modifiedCount || 0;
        }
      }
    }

    // ===== 3. PROCESS VARIANTS SHEETS (Variants -> VariantSummary, ExpandedVariants + DYOExpandedVariants) =====
    // Load all products into cache for fast lookup
    const allProducts = await Product.find({});
    const productMap = new Map();
    allProducts.forEach(p => {
      if (p.productSku) productMap.set(p.productSku, p._id);
    });

    // Process Variants sheet -> VariantSummary
    const variantSummarySheetName = sheetNames.find(n => n.toLowerCase() === 'variants');
    if (variantSummarySheetName) {
      const vSheet = wb.Sheets[variantSummarySheetName];
      const rawData = XLSX.utils.sheet_to_json(vSheet, { header: 1, defval: '' });

      if (rawData.length >= 2) {
        const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
        const ops = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.length === 0) continue;

          const getValue = (colName) => {
            const idx = headers.findIndex(h => h === colName.toLowerCase());
            return idx >= 0 && row[idx] !== undefined ? normalizeString(row[idx]) : undefined;
          };

          const productSku = getValue('productsku');
          const variantSku = getValue('variantsku');
          if (!variantSku || !productSku) continue;

          const update = {
            productSku,
            variantSku,
            metalTypes: toArrayOfStrings(getValue('metaltypes')),
            availableShapes: toArrayOfStrings(getValue('availableshapes')),
            metalWeight: toNumber(getValue('metalweight')),
            diamondType: getValue('diamondtype'),
            stock: toNumber(getValue('stock')) || 0,
            centerStoneWeights: toArrayOfNumbers(getValue('centerstoneweights')),
            sideStoneWeights: toArrayOfNumbers(getValue('sidestoneweights')),
            active: toBoolean(getValue('active'), true),
            readyToShip: toBoolean(getValue('readytoship'), false)
          };

          Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

          ops.push({
            updateOne: {
              filter: { variantSku },
              update: { $set: update },
              upsert: true
            }
          });
        }

        if (ops.length > 0) {
          const result = await VariantSummary.bulkWrite(ops, { ordered: false });
          results.variantSummaries.processed = ops.length;
          results.variantSummaries.created = result.upsertedCount || 0;
          results.variantSummaries.updated = result.modifiedCount || 0;
        }
      }
    }

    // Process ExpandedVariants sheet
    const expandedVariantsSheetName = sheetNames.find(n => n.toLowerCase() === 'expandedvariants');
    if (expandedVariantsSheetName) {
      const variantsSheet = wb.Sheets[expandedVariantsSheetName];
      const rawData = XLSX.utils.sheet_to_json(variantsSheet, { header: 1, defval: '' });
      
      if (rawData.length >= 2) {
        const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
        const variantOps = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.length === 0) continue;

          const getValue = (colName) => {
            const idx = headers.findIndex(h => h === colName.toLowerCase());
            return idx >= 0 && row[idx] !== undefined ? normalizeString(row[idx]) : undefined;
          };

          const variantSku = getValue('variantsku');
          const productSku = getValue('productsku');
          
          if (!variantSku || !productSku) continue;

          const productId = productMap.get(productSku);
          if (!productId) continue; // Skip if product doesn't exist

          const update = {
            product: productId,
            productSku: productSku,
            variantSku: variantSku,
            metalType: getValue('metaltype'),
            metalCode: getValue('metalcode'),
            shape_code: getValue('shape_code'),
            centerStoneWeight: toNumber(getValue('centerstoneweight')),
            centerStonePrice: toNumber(getValue('centerstoneprice')),
            sideStoneWeight: toNumber(getValue('sidestoneweight')),
            sideStonePrice: toNumber(getValue('sidestoneprice')),
            diamondType: getValue('diamondtype'),
            // newly mapped attributes
            clarity: getValue('clarity'),
            color: getValue('color'),
            cut: getValue('cut'),
            metalWeight: toNumber(getValue('metalweight')),
            metalBasePrice: toNumber(getValue('metalbaseprice')),
            metalPrice: toNumber(getValue('metalprice')),
            stock: toNumber(getValue('stock')) || 0,
            active: toBoolean(getValue('active'), true),
            totalPrice: toNumber(getValue('totalprice'))
          };

          Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

          const filter = {
            variantSku: variantSku,
            metalCode: update.metalCode,
            shape_code: update.shape_code,
            centerStoneWeight: update.centerStoneWeight
          };

          variantOps.push({
            updateOne: {
              filter,
              update: { $set: update },
              upsert: true
            }
          });
        }

        if (variantOps.length > 0) {
          const result = await ExpandedVariant.bulkWrite(variantOps, { ordered: false });
          results.expandedVariants.processed += variantOps.length;
          results.expandedVariants.created += result.upsertedCount || 0;
          results.expandedVariants.updated += result.modifiedCount || 0;
        }
      }
    }

    // Process DYOExpandedVariants sheet - Separate model for Design Your Own variants
    const dyoExpandedVariantsSheetName = sheetNames.find(n => n.toLowerCase() === 'dyoexpandedvariants');
    if (dyoExpandedVariantsSheetName) {
      const variantsSheet = wb.Sheets[dyoExpandedVariantsSheetName];
      const rawData = XLSX.utils.sheet_to_json(variantsSheet, { header: 1, defval: '' });
      
      if (rawData.length >= 2) {
        const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
        const dyoVariantOps = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.length === 0) continue;

          const getValue = (colName) => {
            const idx = headers.findIndex(h => h === colName.toLowerCase());
            return idx >= 0 && row[idx] !== undefined ? normalizeString(row[idx]) : undefined;
          };

          const variantSku = getValue('variantsku');
          const productSku = getValue('productsku');
          
          if (!variantSku || !productSku) continue;

          const productId = productMap.get(productSku);
          if (!productId) continue; // Skip if product doesn't exist

          const update = {
            product: productId,
            productSku: productSku,
            variantSku: variantSku,
            productName: getValue('productname'),
            metalType: getValue('metaltype'),
            metalCode: getValue('metalcode'),
            shape_code: getValue('shape_code'),
            metalWeight: toNumber(getValue('metalweight')),
            metalBasePrice: toNumber(getValue('metalbaseprice')),
            metalPrice: toNumber(getValue('metalprice')),
            readyToShip: toBoolean(getValue('readytoship'), false),
            active: toBoolean(getValue('active'), true)
          };

          Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

          dyoVariantOps.push({
            updateOne: {
              filter: { variantSku: variantSku },
              update: { $set: update },
              upsert: true
            }
          });
        }

        if (dyoVariantOps.length > 0) {
          const result = await DYOExpandedVariant.bulkWrite(dyoVariantOps, { ordered: false });
          results.dyoExpandedVariants.processed = dyoVariantOps.length;
          results.dyoExpandedVariants.created = result.upsertedCount || 0;
          results.dyoExpandedVariants.updated = result.modifiedCount || 0;
        }
      }
    }

    // Process DYOVariants sheet - product-level arrays for DYO options
    const dyoVariantsSheetName = sheetNames.find(n => n.toLowerCase() === 'dyovariants');
    if (dyoVariantsSheetName) {
      const sheet = wb.Sheets[dyoVariantsSheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rawData.length >= 2) {
        const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
        const ops = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (row.length === 0) continue;

          const getValue = (colName) => {
            const idx = headers.findIndex(h => h === colName.toLowerCase());
            return idx >= 0 && row[idx] !== undefined ? normalizeString(row[idx]) : undefined;
          };

          const productSku = getValue('productsku');
          if (!productSku) continue;

          const productId = productMap.get(productSku);

          const update = {
            product: productId || undefined,
            productSku,
            metalTypes: toArrayOfStrings(getValue('metaltypes')),
            shapes: toArrayOfStrings(getValue('shapes')),
            active: toBoolean(getValue('active'), true)
          };

          Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

          ops.push({
            updateOne: {
              filter: { productSku },
              update: { $set: update },
              upsert: true
            }
          });
        }

        if (ops.length > 0) {
          const DYOVariant = require('../../models/admin/DYOVariant');
          const result = await DYOVariant.bulkWrite(ops, { ordered: false });
          results.dyoVariants.processed = ops.length;
          results.dyoVariants.created = result.upsertedCount || 0;
          results.dyoVariants.updated = result.modifiedCount || 0;
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    res.status(200).json({ 
      success: true,
      message: `Bulk upload completed successfully in ${duration}s`,
      duration: `${duration}s`,
      results: {
        metals: results.metals,
        products: results.products,
        variantSummaries: results.variantSummaries,
        expandedVariants: results.expandedVariants,
        dyoExpandedVariants: results.dyoExpandedVariants,
        dyoVariants: results.dyoVariants
      },
      summary: `Metals: ${results.metals.created} created, ${results.metals.updated} updated | Products: ${results.products.created} created, ${results.products.updated} updated | VariantSummaries: ${results.variantSummaries.created} created, ${results.variantSummaries.updated} updated | ExpandedVariants: ${results.expandedVariants.created} created, ${results.expandedVariants.updated} updated | DYOVariants: ${results.dyoVariants.created} created, ${results.dyoVariants.updated} updated | DYOExpandedVariants: ${results.dyoExpandedVariants.created} created, ${results.dyoExpandedVariants.updated} updated`
    });
  } catch (err) {
    console.error('Bulk upload error:', err);
    next(err);
  }
};

