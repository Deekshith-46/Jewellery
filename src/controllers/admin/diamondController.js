const DiamondSpec = require('../../models/admin/DiamondSpec');
const Shape = require('../../models/admin/Shape');
const XLSX = require('xlsx');
const { uploadBuffer, cloudinary } = require('../../utils/cloudinary');

function toNumber(val) {
  if (val === null || val === undefined || val === '') return undefined;
  const s = String(val).toString();
  const match = s.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isNaN(n) ? undefined : n;
}

// Helper function to upload image URL to Cloudinary
async function uploadImageToCloudinary(imageUrl, folder = 'diamonds') {
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') return null;
  
  try {
    // Check if it's already a Cloudinary URL
    if (imageUrl.includes('cloudinary.com')) return imageUrl;
    
    // Skip invalid URLs
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      console.warn(`Invalid URL format: ${imageUrl}`);
      return null;
    }
    
    // Upload external URL to Cloudinary
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: folder,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ],
      timeout: 30000 // 30 second timeout
    });
    return result.secure_url;
  } catch (error) {
    console.warn(`Failed to upload image ${imageUrl}:`, error.message);
    return null;
  }
}


function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = String(k).toLowerCase().replace(/\s|_/g, '');
    out[nk] = v;
  }
  return out;
}

function getVal(obj, keys) {
  for (const k of keys) {
    const nk = k.toLowerCase().replace(/\s|_/g, '');
    if (obj[nk] !== undefined && obj[nk] !== '') {
      const v = obj[nk];
      return typeof v === 'string' ? v.trim() : v;
    }
  }
  return undefined;
}

async function resolveShapeId(input) {
  if (!input) return undefined;
  const isId = require('mongoose').Types.ObjectId.isValid(input);
  if (isId) return input;
  const canon = String(input).trim().replace(/\s+/g, ' ');
  const byCode = await Shape.findOne({ code: new RegExp('^' + canon + '$', 'i') });
  if (byCode) return byCode._id;
  const byLabel = await Shape.findOne({ label: new RegExp('^' + canon + '$', 'i') });
  return byLabel ? byLabel._id : undefined;
}

async function ensureShapeId(input) {
  const existing = await resolveShapeId(input);
  if (existing) return existing;
  if (!input) return undefined;
  const codeRaw = String(input).trim();
  const codeCanonical = codeRaw.replace(/\s+/g, ' ').toUpperCase();
  const label = codeRaw
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
  try {
    const shape = await Shape.findOneAndUpdate(
      { code: codeCanonical },
      { $setOnInsert: { code: codeCanonical, label } },
      { new: true, upsert: true }
    );
    return shape._id;
  } catch (e) {
    const again = await Shape.findOne({ code: codeCanonical });
    return again ? again._id : undefined;
  }
}

exports.generateDiamonds = async (req, res, next) => {
  try {
    const { shapeId: shapeIdRaw, shape, carats = [], cuts = [], colors = [], clarities = [], basePricePerCarat = 0, labGrown = false } = req.body || {};
    const shapeId = shapeIdRaw || await resolveShapeId(shape);
    if (!shapeId) return res.status(400).json({ message: 'shapeId is required (or a resolvable shape code/label)' });

    const docs = [];
    for (const carat of carats) {
      for (const cut of cuts) {
        for (const color of colors) {
          for (const clarity of clarities) {
            const pricePerCarat = Number(basePricePerCarat) || 0;
            const price = Number((pricePerCarat * Number(carat)).toFixed(2));
            const sku = [String(shapeId).slice(-6), carat, cut, color, clarity].join('-');
            docs.push({ sku, shapeId, carat: Number(carat), cut, color, clarity, labGrown, price, stock: 1, available: true, active: true });
          }
        }
      }
    }
    if (!docs.length) return res.status(400).json({ message: 'No combinations provided' });
    const created = await DiamondSpec.insertMany(docs, { ordered: false });
    res.status(201).json({ created: created.length });
  } catch (err) { next(err); }
};

exports.bulkUploadDiamonds = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'file is required' });
    
    console.log('Starting bulk diamond upload...');
    const startTime = Date.now();
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    
    console.log(`Processing ${sheet.length} rows...`);

    // Step 1: Pre-load all shapes and existing diamonds to avoid database queries during processing
    console.log('Loading shapes and existing diamonds...');
    const [allShapes, existingDiamonds] = await Promise.all([
      Shape.find({}).select('_id code label').lean(),
      DiamondSpec.find({}).select('sku price pricePerCarat carat color purity cut shape available active').lean()
    ]);
    
    const shapeMap = new Map();
    allShapes.forEach(shape => {
      shapeMap.set(shape.code?.toLowerCase(), shape._id);
      shapeMap.set(shape.label?.toLowerCase(), shape._id);
    });
    
    const existingDiamondMap = new Map();
    existingDiamonds.forEach(d => {
      existingDiamondMap.set(d.sku, d);
    });
    
    console.log(`Loaded ${allShapes.length} shapes and ${existingDiamonds.length} existing diamonds`);

    // Step 2: Process all rows quickly
    const processedRows = [];
    const shapeCache = new Map(); // Cache for new shapes

    for (let i = 0; i < sheet.length; i++) {
      const row = normalizeRow(sheet[i]);
      
      // Debug: Log first few rows to see what data we're getting
      if (i < 3) {
        console.log(`Row ${i + 1} raw data:`, Object.keys(row));
        console.log(`Row ${i + 1} sample values:`, {
          stock: getVal(row, ['stock', 'stockid', 'stockno', 'stocknumber']),
          shape: getVal(row, ['shape', 'shapename', 'shapecode']),
          carat: getVal(row, ['carat', 'caratweight', 'weight']),
          size: getVal(row, ['size']),
          color: getVal(row, ['color', 'colour']),
          purity: getVal(row, ['purity', 'clarity'])
        });
      }
      
      // Map Excel fields to schema fields
      const map = {
        // Core identification
        sku: getVal(row, ['sku', 'stock', 'stockid', 'stockno', 'stocknumber']),
        stock: toNumber(getVal(row, ['stock', 'qty', 'quantity'])) || 0,
        available: (() => {
          const val = getVal(row, ['available', 'isavailable', 'status']);
          if (val === undefined) return true;
          const s = String(val).trim().toLowerCase();
          // available = true, onhold = false
          return s === 'available' || ['y', 'yes', '1', 'true'].includes(s);
        })(),
        active: (() => {
          const val = getVal(row, ['active', 'isactive', 'enabled']);
          if (val === undefined) return true;
          const s = String(val).trim().toLowerCase();
          // active = true, inactive = false
          return s === 'active' || ['y', 'yes', '1', 'true'].includes(s);
        })(),
        location: getVal(row, ['location']),
        
        // Diamond specifications
        shape: getVal(row, ['shape', 'shapename', 'shapecode']),
        carat: toNumber(getVal(row, ['carat', 'caratweight', 'weight', 'size'])), // Try 'size' column for carat
        size: getVal(row, ['size']),
        sizeRange: getVal(row, ['sizerange', 'size_range', 'sizerange']),
        color: getVal(row, ['color', 'colour']),
        purity: getVal(row, ['purity', 'clarity']),
        cut: getVal(row, ['cut']),
        polish: getVal(row, ['polish']),
        symmetry: getVal(row, ['sym', 'symmetry']),
        fluorescence: getVal(row, ['flou', 'fluo', 'fluor', 'fluoro', 'fluorescence']),
        measurement: getVal(row, ['measurement', 'measurements']),
        ratio: getVal(row, ['ratio']),
        lab: getVal(row, ['lab', 'laboratory']),
        
        // Pricing
        pricePerCarat: toNumber(getVal(row, ['percarat', 'pricepercarat', 'ratepercarat', 'ppc', 'percarat'])),
        price: toNumber(getVal(row, ['price', 'amount'])),
        
        // Certificate
        certNumber: getVal(row, ['certnumber', 'certno', 'certificate', 'certnumber']),
        certUrl: getVal(row, ['certiurl', 'certificateurl', 'certurl']),
        
        // Physical measurements
        table: toNumber(getVal(row, ['table'])),
        crownHeight: toNumber(getVal(row, ['crownheight', 'crown_height'])),
        pavilionDepth: toNumber(getVal(row, ['paviliondepth', 'paviliandepth', 'pavilion_depth'])),
        depth: toNumber(getVal(row, ['depth'])),
        crownAngle: toNumber(getVal(row, ['crownangle', 'crown_angle'])),
        pavilionAngle: toNumber(getVal(row, ['pavilionangle', 'paviliangle', 'pavilion_angle'])),
        
        // Additional info
        comment: getVal(row, ['comment', 'remarks']),
        videoUrl: getVal(row, ['videourl', 'video', 'videourl']),
        imageUrl: getVal(row, ['imageurl', 'image', 'imageurl'])
      };

      // Extract carat from SIZE column if not found in carat field
      if (!map.carat && map.size) {
        const sizeMatch = String(map.size).match(/(\d+\.?\d*)\s*cts?\.?/i);
        if (sizeMatch) {
          map.carat = parseFloat(sizeMatch[1]);
          console.log(`Extracted carat ${map.carat} from size field for row ${i + 1}`);
        }
      }
      
      // Skip rows without essential data - be more flexible
      if (!map.carat) {
        console.log(`Skipping row ${i + 1}: Missing carat value. Size field: ${map.size}`);
        continue;
      }
      
      // If no shape provided, use a default or skip
      if (!map.shape) {
        console.log(`Skipping row ${i + 1}: Missing shape value`);
        continue;
      }

      // Fast shape resolution using cache
      let resolvedShapeId = shapeMap.get(map.shape?.toLowerCase());
      
      if (!resolvedShapeId) {
        // Create new shape if not found (batch create at end for better performance)
        if (!shapeCache.has(map.shape)) {
          shapeCache.set(map.shape, null); // Mark for creation
        }
        resolvedShapeId = shapeCache.get(map.shape);
      }

      // Generate SKU if not provided
      const sku = map.sku || map.certNumber || 
        [String(resolvedShapeId).slice(-6), map.carat || '0', map.cut || 'CUT', map.color || 'C', map.purity || 'CL'].join('-');

      // Store URLs directly as strings for fast upload
      const imageUrl = map.imageUrl && map.imageUrl.trim() !== '' ? map.imageUrl.trim() : null;
      const videoUrl = map.videoUrl && map.videoUrl.trim() !== '' ? map.videoUrl.trim() : null;

      processedRows.push({
        sku,
        stock: map.stock,
        available: map.available,
        active: map.active,
        location: map.location,
        shape: resolvedShapeId,
        carat: map.carat,
        size: map.size,
        sizeRange: map.sizeRange,
        color: map.color,
        purity: map.purity,
        cut: map.cut,
        polish: map.polish,
        symmetry: map.symmetry,
        fluorescence: map.fluorescence,
        measurement: map.measurement,
        ratio: map.ratio,
        lab: map.lab,
        pricePerCarat: map.pricePerCarat,
        price: map.price,
        certNumber: map.certNumber,
        certUrl: map.certUrl,
        table: map.table,
        crownHeight: map.crownHeight,
        pavilionDepth: map.pavilionDepth,
        depth: map.depth,
        crownAngle: map.crownAngle,
        pavilionAngle: map.pavilionAngle,
        comment: map.comment,
        videoUrl: videoUrl, // Save URL directly as string
        imageUrl: imageUrl  // Save URL directly as string
      });
    }

    console.log(`Processed ${processedRows.length} valid rows out of ${sheet.length} total rows`);

    if (processedRows.length === 0) {
      return res.status(400).json({ message: 'No valid diamond rows found in sheet' });
    }

    // Step 2.5: Batch create new shapes for better performance
    const shapesToCreate = Array.from(shapeCache.entries()).filter(([name, id]) => id === null);
    if (shapesToCreate.length > 0) {
      console.log(`Creating ${shapesToCreate.length} new shapes...`);
      const newShapes = await Promise.all(
        shapesToCreate.map(([name]) => 
          Shape.create({
            code: name.toUpperCase(),
            label: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
          })
        )
      );
      
      // Update caches with new shape IDs
      newShapes.forEach((shape, index) => {
        const [name] = shapesToCreate[index];
        shapeCache.set(name, shape._id);
        shapeMap.set(name.toLowerCase(), shape._id);
      });
      
      // Update processed rows with resolved shape IDs
      processedRows.forEach(row => {
        if (!row.shape || !require('mongoose').Types.ObjectId.isValid(row.shape)) {
          const shapeName = Object.keys(row).find(key => 
            shapeCache.has(row[key]) && shapeCache.get(row[key]) === null
          );
          if (shapeName) {
            row.shape = shapeCache.get(shapeName);
          }
        }
      });
    }

    // Step 3: Generate unique SKUs
    const seenSku = new Set();
    const uniqueDocs = processedRows.map((doc, idx) => {
      const base = (doc.certNumber && String(doc.certNumber).trim()) || doc.sku;
      let sku = String(base || doc.sku || '').trim();
      if (!sku) {
        sku = [String(doc.shape).slice(-6), doc.carat || '0', doc.cut || 'CUT', doc.color || 'C', doc.purity || 'CL'].join('-');
      }
      let finalSku = sku;
      let n = 1;
      while (seenSku.has(finalSku)) {
        finalSku = `${sku}-${n++}`;
      }
      seenSku.add(finalSku);
      return { ...doc, sku: finalSku };
    });

    // Step 4: Bulk write to database with detailed tracking
    console.log('Writing to database...');
    
    // Track different types of changes for existing diamonds
    const priceUpdates = [];
    const detailUpdates = [];
    const newDiamonds = [];

    const ops = uniqueDocs.map(d => {
      const { sku, ...updateData } = d;
      const existing = existingDiamondMap.get(sku);
      
      if (existing) {
        // Track what changed for existing diamonds
        const changes = [];
        
        // Check price changes
        if (existing.price !== updateData.price || existing.pricePerCarat !== updateData.pricePerCarat) {
          priceUpdates.push({
            sku,
            oldPrice: existing.price,
            newPrice: updateData.price,
            oldPricePerCarat: existing.pricePerCarat,
            newPricePerCarat: updateData.pricePerCarat
          });
          changes.push('price');
        }
        
        // Check other detail changes
        const detailFields = ['carat', 'color', 'purity', 'cut', 'shape', 'available', 'active'];
        const detailChanges = detailFields.filter(field => {
          const existingValue = existing[field]?.toString();
          const newValue = updateData[field]?.toString();
          return existingValue !== newValue;
        });
        
        if (detailChanges.length > 0) {
          detailUpdates.push({
            sku,
            changes: detailChanges,
            oldValues: detailChanges.reduce((acc, field) => {
              acc[field] = existing[field];
              return acc;
            }, {}),
            newValues: detailChanges.reduce((acc, field) => {
              acc[field] = updateData[field];
              return acc;
            }, {})
          });
          changes.push(...detailChanges);
        }
        
        if (changes.length === 0) {
          console.log(`No changes detected for SKU: ${sku}`);
        }
      } else {
        // This is a new diamond
        newDiamonds.push({
          sku,
          carat: updateData.carat,
          color: updateData.color,
          purity: updateData.purity,
          cut: updateData.cut,
          price: updateData.price
        });
      }
      
      return {
        updateOne: {
          filter: { sku },
          update: { $set: updateData, $setOnInsert: { sku } },
          upsert: true
        }
      };
    });

    const result = await DiamondSpec.bulkWrite(ops, { ordered: false });
    const upserts = result.upsertedCount || 0;
    const modified = result.modifiedCount || 0;
    
    const endTime = Date.now();
    const processingTime = (endTime - startTime) / 1000;
    
    console.log(`Bulk upload completed in ${processingTime}s`);
    console.log(`Created: ${upserts}, Updated: ${modified}`);
    console.log(`New diamonds: ${newDiamonds.length}, Price updates: ${priceUpdates.length}, Detail updates: ${detailUpdates.length}`);
    
    res.status(201).json({ 
      totalRows: sheet.length, 
      validRows: uniqueDocs.length, 
      created: upserts, 
      updated: modified,
      newDiamonds: newDiamonds.length,
      priceUpdates: priceUpdates.length,
      detailUpdates: detailUpdates.length,
      summary: {
        newDiamonds: newDiamonds.slice(0, 10), // Show first 10 new diamonds
        priceUpdateDetails: priceUpdates.slice(0, 10), // Show first 10 price updates
        detailUpdateDetails: detailUpdates.slice(0, 10) // Show first 10 detail updates
      },
      processingTime: `${processingTime}s`,
      message: `Upload completed successfully! ${upserts} new diamonds added, ${modified} existing diamonds updated (${priceUpdates.length} price changes, ${detailUpdates.length} detail changes).`
    });
  } catch (err) { 
    console.error('Bulk upload error:', err);
    next(err); 
  }
};


exports.createDiamond = async (req, res, next) => {
  try {
    const data = { ...req.body };
    
    // Upload images to Cloudinary if provided
    if (data.imageUrl) {
      data.imageUrl = await uploadImageToCloudinary(data.imageUrl, 'diamonds');
    }
    if (data.videoUrl) {
      data.videoUrl = await uploadImageToCloudinary(data.videoUrl, 'diamonds');
    }
    
    const d = new DiamondSpec(data);
    await d.save();
    res.status(201).json(d);
  } catch (err) { next(err); }
};

exports.updateDiamond = async (req, res, next) => {
  try {
    const data = { ...req.body };
    
    // Upload images to Cloudinary if provided
    if (data.imageUrl) {
      data.imageUrl = await uploadImageToCloudinary(data.imageUrl, 'diamonds');
    }
    if (data.videoUrl) {
      data.videoUrl = await uploadImageToCloudinary(data.videoUrl, 'diamonds');
    }
    
    const d = await DiamondSpec.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!d) return res.status(404).json({ message: 'Not found' });
    res.json(d);
  } catch (err) { next(err); }
};

exports.deleteDiamond = async (req, res, next) => {
  try {
    const d = await DiamondSpec.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

// Deactivate a specific diamond (admin-only) - PATCH method
exports.deactivateDiamondByAdmin = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!require('mongoose').Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await DiamondSpec.findByIdAndUpdate(id, { active: false }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Diamond deactivated successfully', diamond: doc });
  } catch (err) { next(err); }
};

// Activate a specific diamond (admin-only) - PATCH method
exports.activateDiamondByAdmin = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!require('mongoose').Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await DiamondSpec.findByIdAndUpdate(id, { active: true }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Diamond activated successfully', diamond: doc });
  } catch (err) { next(err); }
};

// Get all diamonds with advanced filtering
exports.getAllDiamonds = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      shape,
      cut,
      carat,
      minCarat,
      maxCarat,
      clarity,
      color,
      minPrice,
      maxPrice,
      available,
      active,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    // Build filter object
    const filter = {};

    // Shape filter
    if (shape) {
      if (require('mongoose').Types.ObjectId.isValid(shape)) {
        filter.shape = shape;
      } else {
        // Find shape by code or label
        const shapeDoc = await Shape.findOne({
          $or: [
            { code: new RegExp('^' + shape + '$', 'i') },
            { label: new RegExp('^' + shape + '$', 'i') }
          ]
        });
        if (shapeDoc) filter.shape = shapeDoc._id;
      }
    }

    // Cut filter
    if (cut) {
      filter.cut = new RegExp('^' + cut + '$', 'i');
    }

    // Carat filter (exact match with tolerance OR range)
    if (carat || minCarat || maxCarat) {
      filter.carat = {};
      
      if (carat) {
        // Exact carat match with tolerance for floating point precision
        const caratNum = parseFloat(carat);
        if (!isNaN(caratNum)) {
          const tolerance = 0.001; // 0.001 carat tolerance
          filter.carat.$gte = caratNum - tolerance;
          filter.carat.$lte = caratNum + tolerance;
        }
      }
      
      if (minCarat) {
        const minCaratNum = parseFloat(minCarat);
        if (!isNaN(minCaratNum)) {
          filter.carat.$gte = minCaratNum;
        }
      }
      
      if (maxCarat) {
        const maxCaratNum = parseFloat(maxCarat);
        if (!isNaN(maxCaratNum)) {
          filter.carat.$lte = maxCaratNum;
        }
      }
      
      // If no valid carat conditions were set, remove the filter
      if (Object.keys(filter.carat).length === 0) {
        delete filter.carat;
      }
    }

    // Clarity filter
    if (clarity) {
      filter.purity = new RegExp('^' + clarity + '$', 'i');
    }

    // Color filter
    if (color) {
      filter.color = new RegExp('^' + color + '$', 'i');
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Availability filter
    if (available !== undefined) {
      filter.available = available === 'true';
    }

    // Active filter
    if (active !== undefined) {
      if (active === 'true') {
        // Include diamonds where active is true OR active field doesn't exist (default to true)
        filter.$or = (filter.$or || []).concat([
          { active: true },
          { active: { $exists: false } },
          { active: null }
        ]);
      } else {
        // Only show diamonds where active is explicitly false
        filter.active = false;
      }
    }

    // Search filter (searches in SKU, certNumber, comment)
    if (search) {
      const searchConditions = [
        { sku: new RegExp(search, 'i') },
        { certNumber: new RegExp(search, 'i') },
        { comment: new RegExp(search, 'i') }
      ];
      
      if (filter.$or) {
        // If we already have $or conditions (from active filter), we need to combine them properly
        filter.$and = [
          { $or: filter.$or },
          { $or: searchConditions }
        ];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population
    const diamonds = await DiamondSpec.find(filter)
      .populate('shape', 'code label')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await DiamondSpec.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      diamonds,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      },
      filters: {
        shape,
        cut,
        carat,
        minCarat,
        maxCarat,
        clarity,
        color,
        minPrice,
        maxPrice,
        available,
        active,
        search
      }
    });
  } catch (err) {
    next(err);
  }
};

// Get specific diamond by ID
exports.getDiamondById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!require('mongoose').Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid diamond ID' });
    }

    const diamond = await DiamondSpec.findById(id)
      .populate('shape', 'code label')
      .lean();

    if (!diamond) {
      return res.status(404).json({ message: 'Diamond not found' });
    }

    res.json(diamond);
  } catch (err) {
    next(err);
  }
};

// Get diamond filters/options for dropdowns
exports.getDiamondFilters = async (req, res, next) => {
  try {
    // Get unique values for filters
    const [
      shapes,
      cuts,
      clarities,
      colors,
      carats
    ] = await Promise.all([
      Shape.find({}).select('_id code label').sort({ label: 1 }),
      DiamondSpec.distinct('cut').then(cuts => cuts.filter(Boolean).sort()),
      DiamondSpec.distinct('purity').then(clarities => clarities.filter(Boolean).sort()),
      DiamondSpec.distinct('color').then(colors => colors.filter(Boolean).sort()),
      DiamondSpec.distinct('carat').then(carats => carats.filter(Boolean).sort((a, b) => a - b))
    ]);

    // Get price range
    const priceRange = await DiamondSpec.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);

    res.json({
      shapes,
      cuts,
      clarities,
      colors,
      carats,
      priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 }
    });
  } catch (err) {
    next(err);
  }
};


