const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const ExpandedVariant = require('../../models/admin/ExpandedVariant');
const DYOExpandedVariant = require('../../models/admin/DYOExpandedVariant');
const VariantSummary = require('../../models/admin/VariantSummary');
const DYOVariant = require('../../models/admin/DYOVariant');
const Image = require('../../models/admin/Image');

// ===== SHAPE NAME TO CODE MAPPING =====
// Maps full shape names to their abbreviation codes used in shape_code field
// Based on lookup table: Round->RND, Oval->OVL, Princess->PRN, Cushion->CUS, etc.
const SHAPE_NAME_TO_CODE = {
  'round': 'RND',
  'oval': 'OVL',
  'princess': 'PRN',
  'cushion': 'CUS',
  'emerald': 'EMR',
  'radiant': 'RAD',
  'asscher': 'ASH',
  'marquise': 'MAR',
  'heart': 'HRT',
  'pear': 'PEA',
  'baguette': 'BAG'
};

// Helper function to get shape codes from shape names
function getShapeCodes(shapeNames) {
  const codes = new Set();
  shapeNames.forEach(name => {
    const normalized = name.trim().toLowerCase();
    if (SHAPE_NAME_TO_CODE[normalized]) {
      codes.add(SHAPE_NAME_TO_CODE[normalized]);
    }
    // Also add the original name in case it's already a code
    codes.add(name.trim().toUpperCase());
  });
  return Array.from(codes);
}

// ===== STYLE NORMALIZATION =====
// Normalizes style names to handle variations (e.g., "Pave" vs "Pavé", "Channel Set" vs "Channel_Set")
function normalizeStyleName(styleName) {
  if (!styleName) return '';
  const normalized = styleName.trim().toLowerCase();
  
  // Handle accent variations
  if (normalized === 'pave' || normalized === 'pavé') {
    return '(pave|pavé)';
  }
  
  // Handle space/underscore variations (already handled by regex, but return normalized)
  return normalized.replace(/[\s_]+/g, '[\\s_]+');
}

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
      ExpandedVariant.distinct('metalType', variantFilter),
      ExpandedVariant.distinct('shape_code', variantFilter),
      Product.distinct('style', productFilter),
      ExpandedVariant.find(variantFilter, 'metalPrice').lean()
    ]);
    
    // Calculate price range from variants
    const prices = variants.map(v => v.metalPrice).filter(p => p > 0);
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
    const { 
      tab = 'ready', 
      page = 1, 
      limit = 24, 
      search, 
      category, 
      style, 
      shape, 
      metal_type, 
      metalType,
      metalTypes,
      minPrice, 
      maxPrice, 
      sort = '-createdAt' 
    } = req.query;
    const skip = (page - 1) * limit;

    let products = [];
    let total = 0;
    let readyCount = 0;
    let designCount = 0;
    
    // Accept metal_type, metalType, or metalTypes (all for compatibility)
    const metalFilter = metalTypes || metal_type || metalType;

    if (tab === 'design' || tab === 'dyo') {
      // DYO (Design Your Own): Products with readyToShip=false
      // Filters: style, shape, metalTypes (from DYOExpandedVariants), price (min/max from DYOExpandedVariants)
      
      let productIds = null;
      
      // For DYO, use DYOExpandedVariants for filtering metalTypes, shapes, and prices
      // Handle ALL possible filter combinations: style, shape, metalTypes, price
      // Style is always applied at Product level, others can be at variant or product level
      if (metalFilter || shape || minPrice || maxPrice) {
        // If only shape filter (no metalFilter, no price, no style), check Product.defaultShape directly
        if (shape && !metalFilter && !minPrice && !maxPrice) {
          const shapeArray = shape.split(',').map(s => s.trim()).filter(Boolean);
          const shapeCodes = getShapeCodes(shapeArray);
          
          // Build shape filter for Product.defaultShape (search by name)
          const productFilter = { 
            readyToShip: false, 
            active: true
          };
          if (shapeArray.length === 1) {
            productFilter.defaultShape = { $regex: shapeArray[0], $options: 'i' };
          } else {
            productFilter.$or = shapeArray.map(s => ({ defaultShape: { $regex: s, $options: 'i' } }));
          }
          
          // Build shape filter for DYOExpandedVariants.shape_code (search by code)
          const variantFilter = { active: true };
          if (shapeCodes.length === 1) {
            variantFilter.shape_code = { $regex: `^${shapeCodes[0]}$`, $options: 'i' };
          } else {
            variantFilter.$or = shapeCodes.map(code => ({ shape_code: { $regex: `^${code}$`, $options: 'i' } }));
          }
          
          // Check both Product.defaultShape and DYOExpandedVariants.shape_code
          const [productsByDefaultShape, productsByVariantShape] = await Promise.all([
            Product.distinct('_id', productFilter),
            DYOExpandedVariant.distinct('product', variantFilter)
          ]);
          
          // Combine both results (remove duplicates by converting to strings first)
          const allProductIds = [
            ...productsByDefaultShape.map(id => id.toString()), 
            ...productsByVariantShape.map(id => id.toString())
          ];
          productIds = [...new Set(allProductIds)].map(id => new mongoose.Types.ObjectId(id));
          
          if (productIds.length === 0) {
            return res.json({ 
              data: [], 
              total: 0, 
              page: Number(page), 
              pages: 0,
              tab: 'design',
              counts: {
                ready: await Product.countDocuments({ readyToShip: true, active: true }),
                design: await Product.countDocuments({ readyToShip: false, active: true }),
                total: await Product.countDocuments({ active: true })
              }
            });
          }
        } else if (minPrice || maxPrice) {
          // If only price filter (no metalFilter, no shape), check both Product.defaultPrice and DYOExpandedVariants.metalPrice
          if (!metalFilter && !shape) {
            // Build price range filter
            const priceRangeFilter = {};
            if (minPrice) priceRangeFilter.$gte = Number(minPrice);
            if (maxPrice) priceRangeFilter.$lte = Number(maxPrice);
            
            // Build Product filter - check defaultPrice against price range
            const productPriceFilter = {
              readyToShip: false,
              active: true,
              defaultPrice: priceRangeFilter
            };
            
            // Build DYOExpandedVariant filter - check metalPrice against price range
            const variantPriceFilter = {
              active: true,
              metalPrice: priceRangeFilter
            };
            
            // Check both Product.defaultPrice and DYOExpandedVariants.metalPrice
            const [productsByDefaultPrice, productsByVariantPrice] = await Promise.all([
              Product.distinct('_id', productPriceFilter),
              DYOExpandedVariant.distinct('product', variantPriceFilter)
            ]);
            
            // Combine both results (remove duplicates)
            const allProductIds = [
              ...productsByDefaultPrice.map(id => id ? id.toString() : null).filter(Boolean), 
              ...productsByVariantPrice.map(id => id ? id.toString() : null).filter(Boolean)
            ];
            productIds = [...new Set(allProductIds)].map(id => new mongoose.Types.ObjectId(id));
            
            if (productIds.length === 0) {
              return res.json({ 
                data: [], 
                total: 0, 
                page: Number(page), 
                pages: 0,
                tab: 'design',
                counts: {
                  ready: await Product.countDocuments({ readyToShip: true, active: true }),
                  design: await Product.countDocuments({ readyToShip: false, active: true }),
                  total: await Product.countDocuments({ active: true })
                }
              });
            }
          } else {
            // Price filter combined with metalFilter or shape - check both DYOExpandedVariants and Product.defaultPrice
            const priceRangeFilter = {};
            if (minPrice) priceRangeFilter.$gte = Number(minPrice);
            if (maxPrice) priceRangeFilter.$lte = Number(maxPrice);
            
            const dyoVariantFilter = { active: true };
            
            // Build metal conditions
            let metalConditions = null;
            if (metalFilter) {
              const metalArray = metalFilter.split(',').map(m => m.trim()).filter(Boolean);
              metalConditions = metalArray.length === 1 
                ? { metalType: { $regex: metalArray[0], $options: 'i' } }
                : { $or: metalArray.map(m => ({ metalType: { $regex: m, $options: 'i' } })) };
            }
            
            // Build shape conditions
            let shapeConditions = null;
            if (shape) {
              const shapeArray = shape.split(',').map(s => s.trim()).filter(Boolean);
              const shapeCodes = getShapeCodes(shapeArray);
              shapeConditions = shapeCodes.length === 1
                ? { shape_code: { $regex: `^${shapeCodes[0]}$`, $options: 'i' } }
                : { $or: shapeCodes.map(code => ({ shape_code: { $regex: `^${code}$`, $options: 'i' } })) };
            }
            
            // Combine metal and shape filters with $and (both must match if both are provided)
            if (metalConditions && shapeConditions) {
              dyoVariantFilter.$and = [metalConditions, shapeConditions];
            } else if (metalConditions) {
              // Only metal filter
              Object.assign(dyoVariantFilter, metalConditions);
            } else if (shapeConditions) {
              // Only shape filter
              Object.assign(dyoVariantFilter, shapeConditions);
            }
            
            // Apply price filter at DYOExpandedVariant level (using metalPrice)
            dyoVariantFilter.metalPrice = priceRangeFilter;
            
            // Get products from DYOExpandedVariants matching metal/shape + price
            const productsByVariantPrice = await DYOExpandedVariant.distinct('product', dyoVariantFilter);
            
            // Also get products from Product.defaultPrice matching price range
            const productsByDefaultPrice = await Product.distinct('_id', {
              readyToShip: false,
              active: true,
              defaultPrice: priceRangeFilter
            });
            
            // If metalFilter or shape is provided, we need to filter productsByDefaultPrice
            // to only include products that have matching DYOExpandedVariants
            let filteredProductsByDefaultPrice = productsByDefaultPrice;
            if (metalFilter || shape) {
              // Build variant filter for matching (without price, just metal/shape)
              const variantFilterForMatching = { active: true };
              
              // Reuse the same metal and shape conditions logic
              if (metalConditions && shapeConditions) {
                variantFilterForMatching.$and = [metalConditions, shapeConditions];
              } else if (metalConditions) {
                Object.assign(variantFilterForMatching, metalConditions);
              } else if (shapeConditions) {
                Object.assign(variantFilterForMatching, shapeConditions);
              }
              
              // Get products that have matching variants
              const productsWithMatchingVariants = await DYOExpandedVariant.distinct('product', variantFilterForMatching);
              const productsWithMatchingVariantsSet = new Set(productsWithMatchingVariants.map(id => id.toString()));
              
              // Filter productsByDefaultPrice to only include those with matching variants
              filteredProductsByDefaultPrice = productsByDefaultPrice.filter(id => 
                productsWithMatchingVariantsSet.has(id.toString())
              );
            }
            
            // Combine both results (remove duplicates)
            const allProductIds = [
              ...productsByVariantPrice.map(id => id ? id.toString() : null).filter(Boolean),
              ...filteredProductsByDefaultPrice.map(id => id ? id.toString() : null).filter(Boolean)
            ];
            productIds = [...new Set(allProductIds)].map(id => new mongoose.Types.ObjectId(id));
            
            // If no products found, return empty result
            if (productIds.length === 0) {
              return res.json({ 
                data: [], 
                total: 0, 
                page: Number(page), 
                pages: 0,
                tab: 'design',
                counts: {
                  ready: await Product.countDocuments({ readyToShip: true, active: true }),
                  design: await Product.countDocuments({ readyToShip: false, active: true }),
                  total: await Product.countDocuments({ active: true })
                }
              });
            }
          }
        } else {
          // For metalFilter or shape filters (without price), use DYOExpandedVariants
          // When shape is provided, check BOTH Product.defaultShape AND DYOExpandedVariants.shape_code
          const dyoVariantFilter = { active: true };
          
          // Build metal conditions
          let metalConditions = null;
          if (metalFilter) {
            const metalArray = metalFilter.split(',').map(m => m.trim()).filter(Boolean);
            metalConditions = metalArray.length === 1 
              ? { metalType: { $regex: metalArray[0], $options: 'i' } }
              : { $or: metalArray.map(m => ({ metalType: { $regex: m, $options: 'i' } })) };
          }
          
          // Build shape conditions for variants
          let shapeConditions = null;
          let shapeArray = null;
          let shapeCodes = null;
          if (shape) {
            shapeArray = shape.split(',').map(s => s.trim()).filter(Boolean);
            shapeCodes = getShapeCodes(shapeArray);
            shapeConditions = shapeCodes.length === 1
              ? { shape_code: { $regex: `^${shapeCodes[0]}$`, $options: 'i' } }
              : { $or: shapeCodes.map(code => ({ shape_code: { $regex: `^${code}$`, $options: 'i' } })) };
          }
          
          // Combine metal and shape filters with $and (both must match if both are provided)
          if (metalConditions && shapeConditions) {
            dyoVariantFilter.$and = [metalConditions, shapeConditions];
          } else if (metalConditions) {
            // Only metal filter
            Object.assign(dyoVariantFilter, metalConditions);
          } else if (shapeConditions) {
            // Only shape filter
            Object.assign(dyoVariantFilter, shapeConditions);
          }
          
          // Get distinct product ObjectIds that have matching DYOExpandedVariants
          const productsByVariantShape = await DYOExpandedVariant.distinct('product', dyoVariantFilter);
          
          // If shape is provided, ALSO check Product.defaultShape and combine results
          if (shape && shapeArray) {
            const productFilter = { 
              readyToShip: false, 
              active: true
            };
            if (shapeArray.length === 1) {
              productFilter.defaultShape = { $regex: shapeArray[0], $options: 'i' };
            } else {
              productFilter.$or = shapeArray.map(s => ({ defaultShape: { $regex: s, $options: 'i' } }));
            }
            
            // Get products by defaultShape
            const productsByDefaultShape = await Product.distinct('_id', productFilter);
            
            // Combine both results (products from variants AND products from defaultShape)
            const allProductIds = [
              ...productsByVariantShape.map(id => id ? id.toString() : null).filter(Boolean),
              ...productsByDefaultShape.map(id => id ? id.toString() : null).filter(Boolean)
            ];
            productIds = [...new Set(allProductIds)].map(id => new mongoose.Types.ObjectId(id));
          } else {
            // No shape filter, just use variant results
            productIds = productsByVariantShape;
          }
          
          // If no products found with variant filters, return empty result
          if (productIds.length === 0) {
            return res.json({ 
              data: [], 
              total: 0, 
              page: Number(page), 
              pages: 0,
              tab: 'design',
              counts: {
                ready: await Product.countDocuments({ readyToShip: true, active: true }),
                design: await Product.countDocuments({ readyToShip: false, active: true }),
                total: await Product.countDocuments({ active: true })
              }
            });
          }
        }
      }
      
      const filter = { readyToShip: false, active: true };
      
      // If we have productIds from DYOExpandedVariant filtering, apply them
      if (productIds !== null && productIds.length > 0) {
        filter._id = { $in: productIds };
      }
      
      // Apply search filter
      const searchConditions = [];
      if (search) {
        searchConditions.push(
          { productName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        );
      }

      // Apply category filter
      if (category) {
        filter.categories = { $regex: category, $options: 'i' };
      }

      // Apply style filter (search only in Product.style and productName)
      // Support multiple comma-separated styles
      // Handle multi-word styles: "Channel set" matches "channel_set" and vice versa
      // Handle accent variations: "Pave" matches "Pavé" and vice versa
      const styleConditions = [];
      if (style) {
        const styleArray = style.split(',').map(s => s.trim()).filter(Boolean);
        // For each style value, search in style and productName fields
        styleArray.forEach(styleValue => {
          // Normalize style name to handle variations (accents, spaces/underscores)
          const normalized = normalizeStyleName(styleValue);
          
          // Create regex pattern that matches both space and underscore separators
          // e.g., "Channel set" or "channel_set" or "Channel_set" all match
          // Also handle accent variations like "Pave" vs "Pavé"
          let stylePattern;
          if (normalized.includes('(pave|pavé)')) {
            // Special handling for Pave/Pavé accent variation
            stylePattern = '(pave|pavé)';
          } else {
            const escapedValue = styleValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
            stylePattern = escapedValue.replace(/[\s_]+/g, '[\\s_]+');
          }
          
          styleConditions.push(
            { style: { $regex: stylePattern, $options: 'i' } },
            { productName: { $regex: styleValue, $options: 'i' } }
          );
        });
      }

      // Combine search and style filters properly
      // If we already have $and from variant filters, we need to combine properly
      if (searchConditions.length > 0 && styleConditions.length > 0) {
        // Both search and style filters: use $and to combine them
        if (filter.$and) {
          // Already have $and from variant filters, add search and style conditions
          filter.$and.push(
            { $or: searchConditions },
            { $or: styleConditions }
          );
        } else {
          // No existing $and, create new one
          filter.$and = [
            { $or: searchConditions },
            { $or: styleConditions }
          ];
        }
      } else if (searchConditions.length > 0) {
        // Only search filter
        if (filter.$and) {
          filter.$and.push({ $or: searchConditions });
        } else {
          filter.$or = searchConditions;
        }
      } else if (styleConditions.length > 0) {
        // Only style filter
        if (filter.$and) {
          filter.$and.push({ $or: styleConditions });
        } else {
          filter.$or = styleConditions;
        }
      }

      products = await Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit));

      total = await Product.countDocuments(filter);
    } else if (tab === 'ready' || tab === 'rts') {
      // RTS (Ready To Ship): Products with readyToShip=true
      // Filters: style, shape, metalTypes (from Variants/ExpandedVariants), price (min/max from Variants)
      // Handle ALL possible filter combinations
      
      let productIds = null;
      
      // For RTS, filter at variant level for metalTypes, shape, and price
      // Style is applied at Product level after variant filtering
      // If only price filter (no metalFilter, no shape), also check Product.defaultPrice
      if (metalFilter || shape || minPrice || maxPrice) {
        // If only price filter (no metalFilter, no shape), check both Product.defaultPrice and Variants.metalPrice
        if (minPrice || maxPrice) {
          if (!metalFilter && !shape) {
            const priceRangeFilter = {};
            if (minPrice) priceRangeFilter.$gte = Number(minPrice);
            if (maxPrice) priceRangeFilter.$lte = Number(maxPrice);
            
            // Check both Product.defaultPrice and Variants.metalPrice
            const [productsByDefaultPrice, productsByVariantPrice] = await Promise.all([
              Product.distinct('_id', {
                readyToShip: true,
                active: true,
                defaultPrice: priceRangeFilter
              }),
              ExpandedVariant.distinct('product', {
                active: true,
                stock: { $gt: 0 },
                metalPrice: priceRangeFilter
              })
            ]);
            
            // Combine both results (remove duplicates)
            const allProductIds = [
              ...productsByDefaultPrice.map(id => id ? id.toString() : null).filter(Boolean),
              ...productsByVariantPrice.map(id => id ? id.toString() : null).filter(Boolean)
            ];
            productIds = [...new Set(allProductIds)].map(id => new mongoose.Types.ObjectId(id));
            
            if (productIds.length === 0) {
              return res.json({ 
                data: [], 
                total: 0, 
                page: Number(page), 
                pages: 0,
                tab: 'ready',
                counts: {
                  ready: await Product.countDocuments({ readyToShip: true, active: true }),
                  design: await Product.countDocuments({ readyToShip: false, active: true }),
                  total: await Product.countDocuments({ active: true })
                }
              });
            }
          } else {
            // Price filter combined with metalFilter or shape - use Variants only
            const variantFilter = { active: true, stock: { $gt: 0 } };
            
            // Build metal conditions
            let metalConditions = null;
            if (metalFilter) {
              const metalArray = metalFilter.split(',').map(m => m.trim()).filter(Boolean);
              metalConditions = metalArray.length === 1 
                ? { metalType: { $regex: metalArray[0], $options: 'i' } }
                : { $or: metalArray.map(m => ({ metalType: { $regex: m, $options: 'i' } })) };
            }
            
            // Build shape conditions
            let shapeConditions = null;
            if (shape) {
              const shapeArray = shape.split(',').map(s => s.trim()).filter(Boolean);
              const shapeCodes = getShapeCodes(shapeArray);
              // Match both shape codes (RND, OVL, etc.) and shape names (Round, Oval, etc.)
              const shapeRegexPatterns = [];
              shapeCodes.forEach(code => {
                shapeRegexPatterns.push({ shape_code: { $regex: `^${code}$`, $options: 'i' } });
              });
              shapeArray.forEach(name => {
                shapeRegexPatterns.push({ shape_code: { $regex: name, $options: 'i' } });
              });
              
              shapeConditions = shapeRegexPatterns.length === 1
                ? shapeRegexPatterns[0]
                : { $or: shapeRegexPatterns };
            }
            
            // Combine metal and shape filters with $and (both must match if both are provided)
            if (metalConditions && shapeConditions) {
              variantFilter.$and = [metalConditions, shapeConditions];
            } else if (metalConditions) {
              // Only metal filter
              Object.assign(variantFilter, metalConditions);
            } else if (shapeConditions) {
              // Only shape filter
              Object.assign(variantFilter, shapeConditions);
            }
            
            // Apply price filter at variant level (using metalPrice)
            const priceRangeFilter = {};
            if (minPrice) priceRangeFilter.$gte = Number(minPrice);
            if (maxPrice) priceRangeFilter.$lte = Number(maxPrice);
            variantFilter.metalPrice = priceRangeFilter;
            
            // Get distinct product ObjectIds that have matching variants
            productIds = await ExpandedVariant.distinct('product', variantFilter);
            
            // If no products found with variant filters, return empty result
            if (productIds.length === 0) {
              return res.json({ 
                data: [], 
                total: 0, 
                page: Number(page), 
                pages: 0,
                tab: 'ready',
                counts: {
                  ready: await Product.countDocuments({ readyToShip: true, active: true }),
                  design: await Product.countDocuments({ readyToShip: false, active: true }),
                  total: await Product.countDocuments({ active: true })
                }
              });
            }
          }
        } else {
          // Only metalFilter or shape (no price) - use Variants
          const variantFilter = { active: true, stock: { $gt: 0 } };
          
          // Build metal conditions
          let metalConditions = null;
          if (metalFilter) {
            const metalArray = metalFilter.split(',').map(m => m.trim()).filter(Boolean);
            metalConditions = metalArray.length === 1 
              ? { metalType: { $regex: metalArray[0], $options: 'i' } }
              : { $or: metalArray.map(m => ({ metalType: { $regex: m, $options: 'i' } })) };
          }
          
          // Build shape conditions
          let shapeConditions = null;
          if (shape) {
            const shapeArray = shape.split(',').map(s => s.trim()).filter(Boolean);
            const shapeCodes = getShapeCodes(shapeArray);
            // Match both shape codes (RND, OVL, etc.) and shape names (Round, Oval, etc.)
            const shapeRegexPatterns = [];
            shapeCodes.forEach(code => {
              shapeRegexPatterns.push({ shape_code: { $regex: `^${code}$`, $options: 'i' } });
            });
            shapeArray.forEach(name => {
              shapeRegexPatterns.push({ shape_code: { $regex: name, $options: 'i' } });
            });
            
            shapeConditions = shapeRegexPatterns.length === 1
              ? shapeRegexPatterns[0]
              : { $or: shapeRegexPatterns };
          }
          
          // Combine metal and shape filters with $and (both must match if both are provided)
          if (metalConditions && shapeConditions) {
            variantFilter.$and = [metalConditions, shapeConditions];
          } else if (metalConditions) {
            // Only metal filter
            Object.assign(variantFilter, metalConditions);
          } else if (shapeConditions) {
            // Only shape filter
            Object.assign(variantFilter, shapeConditions);
          }
          
          // Get distinct product ObjectIds that have matching variants
            productIds = await ExpandedVariant.distinct('product', variantFilter);
          
          // If no products found with variant filters, return empty result
          if (productIds.length === 0) {
            return res.json({ 
              data: [], 
              total: 0, 
              page: Number(page), 
              pages: 0,
              tab: 'ready',
              counts: {
                ready: await Product.countDocuments({ readyToShip: true, active: true }),
                design: await Product.countDocuments({ readyToShip: false, active: true }),
                total: await Product.countDocuments({ active: true })
              }
            });
          }
        }
      }
      
      const filter = { readyToShip: true, active: true };
      
      // If we have productIds from variant filtering, apply them
      if (productIds !== null && productIds.length > 0) {
        filter._id = { $in: productIds };
      }
      
      // Apply search filter
      const searchConditions = [];
      if (search) {
        searchConditions.push(
          { productName: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        );
      }

      // Apply category filter
      if (category) {
        filter.categories = { $regex: category, $options: 'i' };
      }

      // Apply style filter (search only in Product.style and productName)
      // Support multiple comma-separated styles
      // Handle multi-word styles: "Channel set" matches "channel_set" and vice versa
      // Handle accent variations: "Pave" matches "Pavé" and vice versa
      const styleConditions = [];
      if (style) {
        const styleArray = style.split(',').map(s => s.trim()).filter(Boolean);
        // For each style value, search in style and productName fields
        styleArray.forEach(styleValue => {
          // Normalize style name to handle variations (accents, spaces/underscores)
          const normalized = normalizeStyleName(styleValue);
          
          // Create regex pattern that matches both space and underscore separators
          // e.g., "Channel set" or "channel_set" or "Channel_set" all match
          // Also handle accent variations like "Pave" vs "Pavé"
          let stylePattern;
          if (normalized.includes('(pave|pavé)')) {
            // Special handling for Pave/Pavé accent variation
            stylePattern = '(pave|pavé)';
          } else {
            const escapedValue = styleValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
            stylePattern = escapedValue.replace(/[\s_]+/g, '[\\s_]+');
          }
          
          styleConditions.push(
            { style: { $regex: stylePattern, $options: 'i' } },
            { productName: { $regex: styleValue, $options: 'i' } }
          );
        });
      }

      // Combine search and style filters properly
      // If we already have $and from variant filters, we need to combine properly
      if (searchConditions.length > 0 && styleConditions.length > 0) {
        // Both search and style filters: use $and to combine them
        if (filter.$and) {
          // Already have $and from variant filters, add search and style conditions
          filter.$and.push(
            { $or: searchConditions },
            { $or: styleConditions }
          );
        } else {
          // No existing $and, create new one
          filter.$and = [
            { $or: searchConditions },
            { $or: styleConditions }
          ];
        }
      } else if (searchConditions.length > 0) {
        // Only search filter
        if (filter.$and) {
          filter.$and.push({ $or: searchConditions });
        } else {
          filter.$or = searchConditions;
        }
      } else if (styleConditions.length > 0) {
        // Only style filter
        if (filter.$and) {
          filter.$and.push({ $or: styleConditions });
        } else {
          filter.$or = styleConditions;
        }
      }

      products = await Product.find(filter)
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

// Get all variants for a product (RTS uses Variants, DYO uses DYOExpandedVariants)
// Route: GET /api/products/list/variants?tab=ready|design&productId=...
exports.getProductVariants = async (req, res, next) => {
  try {
    const { productId, tab = 'ready' } = req.query;
    
    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }
    
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

    // Determine which variant model to use based on tab parameter
    // tab=ready or rts -> use Variants (ExpandedVariants sheet)
    // tab=design or dyo -> use DYOExpandedVariants (DYOExpandedVariants sheet)
    let variants = [];
    const productSku = product.productSku || product.productId;
    const isRTS = tab === 'ready' || tab === 'rts';
    
    if (isRTS) {
      // RTS: Use ExpandedVariants sheet
      variants = await ExpandedVariant.find({ 
        $or: [
          { product: product._id },
          { productSku: productSku }
        ],
        active: true,
        stock: { $gt: 0 } // Only show variants with stock > 0 for RTS
      })
      .populate('product', 'productSku productName style defaultShape')
      .sort({ metalType: 1, shape_code: 1, metalPrice: 1 });
    } else {
      // DYO: Use DYOExpandedVariants (from DYOExpandedVariants sheet)
      variants = await DYOExpandedVariant.find({ 
        $or: [
          { product: product._id },
          { productSku: productSku }
        ],
        active: true
      })
      .populate('product', 'productSku productName style defaultShape')
      .sort({ metalType: 1, shape_code: 1, metalPrice: 1 });
    }

    // Also fetch summary/option models as requested
    let variantSummaryData = null;
    let dyoVariantData = null;
    if (isRTS) {
      variantSummaryData = await VariantSummary.find({ productSku: productSku, active: true })
        .sort({ variantSku: 1 })
        .lean();
    } else {
      dyoVariantData = await DYOVariant.findOne({ 
        $or: [
          { product: product._id },
          { productSku: productSku }
        ],
        active: true
      }).lean();
    }

    res.json({ 
      product: {
        _id: product._id,
        productSku: product.productSku,
        productName: product.productName,
        style: product.style,
        defaultShape: product.defaultShape,
        readyToShip: product.readyToShip,
        defaultPrice: product.defaultPrice
      },
      tab: isRTS ? 'ready' : 'design',
      variantType: isRTS ? 'RTS' : 'DYO',
      variantSource: isRTS ? 'ExpandedVariants' : 'DYOExpandedVariants',
      count: variants.length,
      variants,
      // Include additional collections per tab
      ...(isRTS ? { VariantSummary: variantSummaryData } : {}),
      ...(!isRTS ? { DYOVariant: dyoVariantData } : {})
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
    const variants = await ExpandedVariant.find({ 
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
    const variant = await ExpandedVariant.findOne({ 
      variantSku: variantSku,
      $or: [
        { product: product._id },
        { productSku: product.productSku || product.productId }
      ]
    }).populate('product', 'productSku productName');
    
    if (!variant) {
      return res.status(404).json({ message: 'Variant not found' });
    }

    // Use variant's metal_code and shape_code
    const metal = variant.metalCode;
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
      variantSku: variant.variantSku,
      metal,
      shape,
      metalType: variant.metalType,
      shapeType: variant.shape_code,
      images 
    });
  } catch (err) { 
    next(err); 
  }
};

// GET /api/products/:id/price/rts?metalType=14k_yellow_gold&shape=RND&centerStoneWeight=1.5
exports.getRtsPriceForSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { metalType, metal, shape, shapeCode, centerStoneWeight } = req.query;
    const weight = centerStoneWeight !== undefined && centerStoneWeight !== '' ? Number(centerStoneWeight) : undefined;

    // Validate required inputs
    if (!metalType && !metal) {
      return res.status(400).json({ message: 'metalType is required (or metal code via metal=...)' });
    }
    if (!shape && !shapeCode) {
      return res.status(400).json({ message: 'shape is required (shape code, e.g., RND)' });
    }
    if (weight === undefined || Number.isNaN(weight)) {
      return res.status(400).json({ message: 'centerStoneWeight is required and must be a number' });
    }

    // Locate product by productSku, productId, or _id
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

    // Build variant query
    const sku = product.productSku || product.productId;
    const baseVariantQuery = {
      $or: [{ product: product._id }, { productSku: sku }],
      active: true
    };

    // Metal matching: allow either full metalType string or short metalCode
    const variantQuery = { ...baseVariantQuery };
    if (metal) {
      variantQuery.metalCode = String(metal).toUpperCase();
    } else if (metalType) {
      variantQuery.metalType = { $regex: `^${metalType}$`, $options: 'i' };
    }

    // Shape matching: accept exact code or name convertible to code
    if (shapeCode) {
      variantQuery.shape_code = { $regex: `^${String(shapeCode).toUpperCase()}$`, $options: 'i' };
    } else if (shape) {
      const codes = getShapeCodes([String(shape)]);
      variantQuery.shape_code = { $regex: `^${codes[0]}$`, $options: 'i' };
    }

    // Weight match (exact, with small tolerance if needed)
    variantQuery.centerStoneWeight = weight;

    // Try finding in-stock first
    let variant = await ExpandedVariant.findOne({ ...variantQuery, stock: { $gt: 0 } }).lean();
    // If not found, try without stock requirement
    if (!variant) {
      variant = await ExpandedVariant.findOne(variantQuery).lean();
    }
    // If still not found, try with tolerance on weight (±0.01)
    if (!variant && typeof weight === 'number') {
      const tolerantQuery = { 
        ...variantQuery, 
        centerStoneWeight: { $gte: weight - 0.01, $lte: weight + 0.01 } 
      };
      variant = await ExpandedVariant.findOne(tolerantQuery).sort({ stock: -1 }).lean();
    }
    // If still not found, pick the closest weight among matching metal/shape
    if (!variant) {
      const candidates = await ExpandedVariant.find({
        ...baseVariantQuery,
        ...(variantQuery.metalCode ? { metalCode: variantQuery.metalCode } : {}),
        ...(variantQuery.metalType ? { metalType: variantQuery.metalType } : {}),
        ...(variantQuery.shape_code ? { shape_code: variantQuery.shape_code } : {})
      }).lean();
      if (candidates.length > 0 && typeof weight === 'number') {
        candidates.sort((a, b) => Math.abs((a.centerStoneWeight ?? 0) - weight) - Math.abs((b.centerStoneWeight ?? 0) - weight));
        variant = candidates[0];
      }
    }

    if (!variant) {
      return res.status(404).json({ message: 'Matching RTS variant not found for given selection' });
    }

    const metalPrice = Number(variant.metalPrice || 0);
    const centerStonePrice = Number(variant.centerStonePrice || 0);
    const sideStonePrice = Number(variant.sideStonePrice || 0);
    const totalPrice = Number(variant.totalPrice || metalPrice + centerStonePrice + sideStonePrice);

    res.json({
      product: {
        _id: product._id,
        productSku: sku
      },
      variantSku: variant.variantSku,
      metalType: variant.metalType,
      metalCode: variant.metalCode,
      shape_code: variant.shape_code,
      centerStoneWeight: variant.centerStoneWeight,
      prices: {
        metalPrice,
        centerStonePrice,
        sideStonePrice,
        totalPrice
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id/price/dyo?metalType=14k_yellow_gold&shape=RND
// Also accepts metal=14Y and shapeCode=RND
exports.getDyoPriceForSelection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { metalType, metal, shape, shapeCode } = req.query;

    if (!metalType && !metal) {
      return res.status(400).json({ message: 'metalType is required (or metal code via metal=...)' });
    }
    if (!shape && !shapeCode) {
      return res.status(400).json({ message: 'shape is required (shape code, e.g., RND)' });
    }

    // Locate product by productSku, productId, or _id
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

    const sku = product.productSku || product.productId;
    const baseQuery = {
      $or: [{ product: product._id }, { productSku: sku }],
      active: true
    };

    const query = { ...baseQuery };
    if (metal) {
      query.metalCode = String(metal).toUpperCase();
    } else if (metalType) {
      query.metalType = { $regex: `^${metalType}$`, $options: 'i' };
    }
    if (shapeCode) {
      query.shape_code = { $regex: `^${String(shapeCode).toUpperCase()}$`, $options: 'i' };
    } else if (shape) {
      const codes = getShapeCodes([String(shape)]);
      query.shape_code = { $regex: `^${codes[0]}$`, $options: 'i' };
    }

    // Prefer active latest doc; no stock gating for DYO
    let variant = await DYOExpandedVariant.findOne(query).sort({ updatedAt: -1 }).lean();
    // Fallback: if searching by metal code fails, try mapping to metalType string
    if (!variant && metal) {
      const METAL_CODE_TO_TYPE = {
        '14W': '14k_white_gold',
        '14Y': '14k_yellow_gold',
        '14R': '14k_rose_gold',
        '18W': '18k_white_gold',
        '18Y': '18k_yellow_gold',
        '18R': '18k_rose_gold',
        'P': 'platinum',
        'PT': 'platinum'
      };
      const mapped = METAL_CODE_TO_TYPE[String(metal).toUpperCase()];
      if (mapped) {
        const altQuery = { ...baseQuery, metalType: { $regex: `^${mapped}$`, $options: 'i' } };
        if (query.shape_code) altQuery.shape_code = query.shape_code;
        variant = await DYOExpandedVariant.findOne(altQuery).sort({ updatedAt: -1 }).lean();
      }
    }
    // If still not found, return options to help client choose valid combo
    if (!variant) {
      const options = await DYOExpandedVariant.find(baseQuery).select('metalCode metalType shape_code').lean();
      let availableMetalCodes = [...new Set(options.map(o => o.metalCode).filter(Boolean))];
      let availableMetalTypes = [...new Set(options.map(o => o.metalType).filter(Boolean))];
      let availableShapes = [...new Set(options.map(o => o.shape_code).filter(Boolean))];
      // Fallback to DYOVariant product-level options if expanded options missing
      if (availableMetalCodes.length === 0 && availableMetalTypes.length === 0 && availableShapes.length === 0) {
        try {
          const DYOVariant = require('../../models/admin/DYOVariant');
          const dyoVariantDoc = await DYOVariant.findOne({ $or: [{ product: product._id }, { productSku: sku }] }).lean();
          if (dyoVariantDoc) {
            availableMetalCodes = dyoVariantDoc.metalTypes || [];
            availableShapes = dyoVariantDoc.shapes || [];
          }
        } catch (e) {
          // ignore fallback errors
        }
      }
      return res.status(404).json({ 
        message: 'Matching DYO option not found for given selection',
        debug: {
          tried: { metal: metal || metalType, shape: shape || shapeCode },
          availableMetalCodes,
          availableMetalTypes,
          availableShapes
        }
      });
    }

    res.json({
      product: {
        _id: product._id,
        productSku: sku
      },
      metalType: variant.metalType,
      metalCode: variant.metalCode,
      shape_code: variant.shape_code,
      prices: {
        metalBasePrice: Number(variant.metalBasePrice || 0),
        metalPrice: Number(variant.metalPrice || 0)
      },
      meta: {
        metalWeight: Number(variant.metalWeight || 0)
      }
    });
  } catch (err) {
    next(err);
  }
};


