const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Style = require('../../models/admin/Style');
const Shape = require('../../models/admin/Shape');
const Category = require('../../models/admin/Category');
const XLSX = require('xlsx');
const slugify = require('slugify');
const { batchUploadImages } = require('../../utils/cloudinary');

// Helper function to normalize column names
const normalizeColumnName = (name) => {
  return String(name || '').toLowerCase().replace(/[\s\-_]+/g, '_').trim();
};

// Helper function to find column by multiple possible names
const findColumn = (row, possibleNames) => {
  const normalizedRow = {};
  Object.keys(row).forEach(key => {
    normalizedRow[normalizeColumnName(key)] = row[key];
  });
  
  for (const name of possibleNames) {
    const normalizedName = normalizeColumnName(name);
    if (normalizedRow[normalizedName] !== undefined && normalizedRow[normalizedName] !== '') {
      return normalizedRow[normalizedName];
    }
  }
  return '';
};

// Helper function to resolve references (Style, Shape, Category)
async function resolveRef(Model, queryKeys, value) {
  if (!value) return undefined;
  const v = String(value || '').trim();
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

// Main Excel processing function
exports.processExcelSheet = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Excel file is required' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    
    if (sheet.length === 0) {
      return res.status(400).json({ message: 'Excel sheet is empty' });
    }

    console.log(`Processing ${sheet.length} rows...`);
    
    // Collect all image URLs for batch upload
    const allImageUrls = new Set();
    const productData = [];

    // First pass: collect all image URLs and prepare product data
    for (let i = 0; i < sheet.length; i++) {
      const row = sheet[i];
      
      // Find product identifier (ID, SKU, or name)
      const productId = findColumn(row, ['id', 'product_id', 'productid', 'sku', 'product_sku', 'productsku']);
      const productName = findColumn(row, ['name', 'product_name', 'productname', 'title', 'product_title']);
      
      if (!productId && !productName) {
        console.warn(`Row ${i + 2}: No product identifier found, skipping`);
        continue;
      }

      // Collect all image URLs from this row
      const rowImages = [];
      
      // Default images
      const defaultImg1 = findColumn(row, ['defaultimg1', 'default_img1', 'defaultimg_1', 'defaultimg1', 'card_img', 'card_image']);
      const defaultImg2 = findColumn(row, ['defaultimg2', 'default_img2', 'defaultimg_2', 'defaultimg2', 'card_img_hover', 'card_image_hover']);
      
      // Variant images
      const variant1 = findColumn(row, ['variant1', 'variant_1', 'variantimg1', 'variant_img1']);
      const variant2 = findColumn(row, ['variant2', 'variant_2', 'variantimg2', 'variant_img2']);
      const variant3 = findColumn(row, ['variant3', 'variant_3', 'variantimg3', 'variant_img3']);
      const variant4 = findColumn(row, ['variant4', 'variant_4', 'variantimg4', 'variant_img4']);
      
      // Add all non-empty image URLs
      [defaultImg1, defaultImg2, variant1, variant2, variant3, variant4].forEach(url => {
        if (url && typeof url === 'string' && url.trim() !== '') {
          allImageUrls.add(url.trim());
          rowImages.push(url.trim());
        }
      });

      // Prepare product data
      const productInfo = {
        rowIndex: i + 2, // Excel row number (accounting for header)
        productId: productId || null,
        productName: productName || null,
        defaultImages: [defaultImg1, defaultImg2].filter(Boolean),
        variantImages: [variant1, variant2, variant3, variant4].filter(Boolean),
        allImages: rowImages,
        // Other fields
        description: findColumn(row, ['description', 'desc', 'product_description']),
        metalPrice: findColumn(row, ['metal_price', 'metalprice', 'price', 'base_price', 'baseprice']),
        stock: findColumn(row, ['stock', 'quantity', 'qty', 'inventory']),
        availability: findColumn(row, ['availability', 'status', 'available']),
        metalType: findColumn(row, ['metal_type', 'metaltype', 'metal', 'metal_types']),
        shape: findColumn(row, ['shape', 'shapes']),
        style: findColumn(row, ['style', 'styles']),
        category: findColumn(row, ['category', 'categories']),
        metalWeight: findColumn(row, ['metal_weight', 'metalweight', 'weight']),
        metalCost: findColumn(row, ['metal_cost', 'metalcost', 'cost']),
        readyToShip: findColumn(row, ['ready_to_ship', 'readytoship', 'ready']),
        active: findColumn(row, ['active', 'is_active', 'enabled'])
      };

      productData.push(productInfo);
    }

    console.log(`Found ${allImageUrls.size} unique image URLs to upload`);

    // Batch upload all images to Cloudinary
    const imageUrlMap = new Map();
    if (allImageUrls.size > 0) {
      console.log('Starting batch upload to Cloudinary...');
      const uploadedUrls = await batchUploadImages(Array.from(allImageUrls), 'products', 10);
      
      // Create mapping from original URLs to Cloudinary URLs
      let uploadedIndex = 0;
      for (const originalUrl of allImageUrls) {
        if (uploadedIndex < uploadedUrls.length) {
          imageUrlMap.set(originalUrl, uploadedUrls[uploadedIndex]);
          uploadedIndex++;
        }
      }
      console.log(`Successfully uploaded ${uploadedUrls.length} images to Cloudinary`);
    }

    // Process products and update database
    const results = {
      totalRows: sheet.length,
      processedRows: productData.length,
      uploadedImages: imageUrlMap.size,
      created: 0,
      updated: 0,
      errors: []
    };

    // Process each product
    for (const productInfo of productData) {
      try {
        // Map uploaded images back to product
        const uploadedDefaultImages = productInfo.defaultImages
          .map(url => imageUrlMap.get(url))
          .filter(Boolean);
        
        const uploadedVariantImages = productInfo.variantImages
          .map(url => imageUrlMap.get(url))
          .filter(Boolean);

        // Resolve references
        const styleId = await resolveRef(Style, ['code', 'name'], productInfo.style);
        const shapeId = await resolveRef(Shape, ['code', 'label'], productInfo.shape);
        const categoryId = await resolveRef(Category, ['code', 'label'], productInfo.category);

        // Prepare update document
        const updateDoc = {
          productName: productInfo.productName || undefined,
          description: productInfo.description || undefined,
          metalPrice: productInfo.metalPrice ? Number(String(productInfo.metalPrice).replace(/[^0-9.]/g, '')) : undefined,
          stock: productInfo.stock ? Number(String(productInfo.stock).replace(/[^0-9.]/g, '')) : 0,
          availability: productInfo.availability || 'available',
          metalType: productInfo.metalType || undefined,
          shape: productInfo.shape || undefined,
          metalWeight: productInfo.metalWeight ? Number(String(productInfo.metalWeight).replace(/[^0-9.]/g, '')) : undefined,
          metalCost: productInfo.metalCost ? Number(String(productInfo.metalCost).replace(/[^0-9.]/g, '')) : undefined,
          readyToShip: productInfo.readyToShip ? String(productInfo.readyToShip).toLowerCase() === 'true' : false,
          active: productInfo.active ? String(productInfo.active).toLowerCase() !== 'false' : true,
          styleId,
          shapeId,
          categoryId,
          // New array fields
          defaultImages: uploadedDefaultImages,
          variantImages: uploadedVariantImages,
          // Legacy fields for backward compatibility
          defaultImg1: uploadedDefaultImages[0] || undefined,
          defaultImg2: uploadedDefaultImages[1] || undefined
        };

        // Generate slug
        if (updateDoc.productName) {
          updateDoc.slug = slugify(updateDoc.productName, { lower: true });
        }

        // Clean undefined fields
        Object.keys(updateDoc).forEach(k => updateDoc[k] === undefined && delete updateDoc[k]);

        // Determine if this is an update or create operation
        let filter = {};
        if (productInfo.productId) {
          // Try to find by ID first
          if (mongoose.Types.ObjectId.isValid(productInfo.productId)) {
            filter = { _id: productInfo.productId };
          } else {
            filter = { productSku: productInfo.productId };
          }
        } else if (productInfo.productName) {
          // Find by name
          filter = { productName: productInfo.productName };
        }

        if (Object.keys(filter).length === 0) {
          results.errors.push({
            row: productInfo.rowIndex,
            error: 'No valid identifier found'
          });
          continue;
        }

        // Check if product exists
        const existingProduct = await Product.findOne(filter);
        
        if (existingProduct) {
          // Update existing product
          await Product.findByIdAndUpdate(existingProduct._id, updateDoc);
          results.updated++;
        } else {
          // Create new product
          const newProduct = new Product(updateDoc);
          await newProduct.save();
          results.created++;
        }

      } catch (error) {
        results.errors.push({
          row: productInfo.rowIndex,
          error: error.message
        });
        console.error(`Error processing row ${productInfo.rowIndex}:`, error.message);
      }
    }

    console.log(`Processing complete: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);
    
    res.status(200).json({
      message: 'Excel processing completed',
      ...results
    });

  } catch (error) {
    console.error('Excel processing error:', error);
    next(error);
  }
};

// Get processing status (for large files)
exports.getProcessingStatus = async (req, res, next) => {
  try {
    // This could be expanded to track processing status for large files
    res.json({
      status: 'ready',
      message: 'Excel processor is ready'
    });
  } catch (error) {
    next(error);
  }
};
