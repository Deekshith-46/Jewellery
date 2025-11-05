const mongoose = require('mongoose');
const BannerImage = require('../../models/admin/BannerImage');
const CollectionImage = require('../../models/admin/CollectionImage');
const CustomerReviewImage = require('../../models/admin/CustomerReviewImage');
const DiamondTypeImage = require('../../models/admin/DiamondTypeImage');
const EngagementRingBanner = require('../../models/admin/EngagementRingBanner');
const FeaturedImage = require('../../models/admin/FeaturedImage');
const { uploadBuffer } = require('../../utils/cloudinary');

/**
 * List all banner images with optional filtering
 * GET /api/admin/images/banners?location=homepage&active=true
 * Query params: location, active, page, limit, sort
 */
exports.getAllBannerImages = async (req, res, next) => {
  try {
    const { location, active, page = 1, limit = 50, sort = 'sort_order' } = req.query;
    
    // Build filter
    const filter = {};
    if (location) {
      filter.location = location;
    } else {
      // Default to homepage if no location specified
      filter.location = 'homepage';
    }
    
    if (active !== undefined) {
      filter.active = String(active).toLowerCase() === 'true';
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Parse sort
    let sortOption = {};
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      sortOption[sortField] = sortOrder;
    } else {
      sortOption = { sort_order: 1 };
    }

    // Execute query
    const [banners, total] = await Promise.all([
      BannerImage.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select('-__v')
        .lean(),
      BannerImage.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: banners.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      banners
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all homepage banner images (backward compatibility)
 * GET /api/admin/images/banners
 */
exports.getBannerImages = async (req, res, next) => {
  try {
    const banners = await BannerImage.find({ location: 'homepage' })
      .sort({ sort_order: 1 })
      .select('-__v');
    
    res.json({
      success: true,
      count: banners.length,
      banners
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a specific banner image by ID
 * GET /api/admin/images/banners/:id
 */
exports.getBannerImageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid banner image ID' 
      });
    }

    const banner = await BannerImage.findById(id).select('-__v');

    if (!banner) {
      return res.status(404).json({ 
        success: false,
        message: 'Banner image not found' 
      });
    }

    res.json({
      success: true,
      banner
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add banner image(s) - supports file uploads (form-data) or URLs
 * POST /api/admin/images/banners
 * 
 * Form-data options:
 *   - image: single file
 *   - images: multiple files (array)
 *   - image_url: single URL string
 *   - image_urls: array of URL strings
 * 
 * Optional fields: title, subtitle, alt_text, link_url, button_text, sort_order
 */
exports.addBannerImages = async (req, res, next) => {
  try {
    // Parse form-data fields (multer puts them in req.body)
    const { image_url, image_urls, title, subtitle, alt_text, link_url, button_text, sort_order } = req.body;
    
    // Check for uploaded files (from multer)
    // upload.fields() puts files in req.files as an object: { image: [...], images: [...] }
    // upload.single() puts file in req.file
    let files = [];
    if (req.files) {
      // Handle fields() - multiple field names
      if (req.files.image && req.files.image.length > 0) {
        files.push(...req.files.image);
      }
      if (req.files.images && req.files.images.length > 0) {
        files.push(...req.files.images);
      }
    } else if (req.file) {
      // Handle single() - single file
      files.push(req.file);
    }
    
    const hasFiles = files.length > 0;
    
    // Check for URLs
    // In form-data, arrays might come as strings, so parse if needed
    let parsedImageUrls = image_urls;
    if (typeof image_urls === 'string') {
      // Try to parse as JSON array, or split by comma
      try {
        parsedImageUrls = JSON.parse(image_urls);
      } catch {
        // If not JSON, split by comma
        parsedImageUrls = image_urls.split(',').map(url => url.trim()).filter(Boolean);
      }
    }
    
    const hasSingleUrl = image_url && typeof image_url === 'string' && image_url.trim() !== '';
    const hasMultipleUrls = parsedImageUrls && Array.isArray(parsedImageUrls) && parsedImageUrls.length > 0;
    const hasUrls = hasSingleUrl || hasMultipleUrls;

    // Validate that at least one source is provided (files or URLs)
    if (!hasFiles && !hasUrls) {
      return res.status(400).json({ 
        success: false,
        message: 'Either upload image file(s) via form-data or provide image_url/image_urls' 
      });
    }

    const uploadedUrls = [];
    const errors = [];

    // Step 1: Upload files to Cloudinary if any
    if (hasFiles) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const result = await uploadBuffer(file.buffer, {
            folder: 'banners',
            resource_type: 'image',
            transformation: [
              { quality: 'auto', fetch_format: 'auto' }
            ]
          });
          uploadedUrls.push(result.secure_url);
        } catch (err) {
          errors.push({ 
            index: i, 
            filename: file.originalname, 
            error: `Failed to upload file: ${err.message}` 
          });
        }
      }
    }

    // Step 2: Collect URLs from request body
    const urlsFromBody = [];
    if (hasSingleUrl) {
      urlsFromBody.push(image_url.trim());
    }
    if (hasMultipleUrls) {
      urlsFromBody.push(...parsedImageUrls.filter(url => url && typeof url === 'string' && url.trim() !== '').map(url => url.trim()));
    }

    // Combine uploaded file URLs with provided URLs
    const urlsToAdd = [...uploadedUrls, ...urlsFromBody];

    // Validate that we have at least one valid URL
    if (urlsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid images were processed. Please check your file uploads or URLs.',
        errors
      });
    }
    
    // Get current max sort_order for homepage banners (only once)
    const maxSortOrder = await BannerImage.findOne({ location: 'homepage' })
      .sort({ sort_order: -1 })
      .select('sort_order');
    
    // Determine starting sort_order
    let startingSortOrder;
    if (sort_order !== undefined) {
      startingSortOrder = Number(sort_order);
      // Check if the provided sort_order conflicts with existing banners
      const conflicting = await BannerImage.findOne({ 
        location: 'homepage', 
        sort_order: startingSortOrder 
      });
      if (conflicting) {
        // If conflicts, start from max + 1
        startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
      }
    } else {
      // If no sort_order provided, start from max + 1
      startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
    }

    const createdBanners = [];

    // Step 3: Process each URL (from files and/or provided URLs)
    for (let i = 0; i < urlsToAdd.length; i++) {
      const url = urlsToAdd[i];
      
      if (!url || typeof url !== 'string' || url.trim() === '') {
        errors.push({ index: i, url, error: 'Invalid URL' });
        continue;
      }

      try {
        // Calculate sort_order for this image (increment from starting point)
        const bannerSortOrder = startingSortOrder + i;

        // Double-check for conflicts (in case of concurrent requests)
        const existing = await BannerImage.findOne({ 
          location: 'homepage', 
          sort_order: bannerSortOrder 
        });

        let finalSortOrder = bannerSortOrder;
        if (existing) {
          // If sort_order still conflicts, find next available
          const nextMax = await BannerImage.findOne({ location: 'homepage' })
            .sort({ sort_order: -1 })
            .select('sort_order');
          finalSortOrder = nextMax ? nextMax.sort_order + 1 : 0;
        }
        
        const banner = new BannerImage({
          location: 'homepage',
          image_url: url.trim(),
          title: title || undefined,
          subtitle: subtitle || undefined,
          alt_text: alt_text || `Banner image ${finalSortOrder + 1}`,
          link_url: link_url || undefined,
          button_text: button_text || undefined,
          sort_order: finalSortOrder,
          active: true
        });
        
        await banner.save();
        createdBanners.push(banner);
      } catch (err) {
        errors.push({ index: i, url, error: err.message });
      }
    }

    if (createdBanners.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create any banner images',
        errors
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdBanners.length} banner image(s)`,
      created: createdBanners.length,
      banners: createdBanners,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update/Replace a banner image
 * PUT /api/admin/images/banners/:id
 * 
 * Supports:
 *   - Form-data with 'image' file field (will upload to Cloudinary)
 *   - JSON body with image_url string
 *   - Other fields: title, subtitle, alt_text, link_url, button_text, sort_order, active
 */
exports.updateBannerImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid banner image ID' 
      });
    }

    const { 
      image_url, 
      title, 
      subtitle, 
      alt_text, 
      link_url, 
      button_text, 
      sort_order, 
      active 
    } = req.body;

    const update = {};
    
    // Handle image update: check for file upload first, then URL
    if (req.file) {
      try {
        // Upload file to Cloudinary
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'banners',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        update.image_url = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } else if (image_url !== undefined) {
      // Use provided URL
      update.image_url = image_url.trim();
    }
    
    // Handle other fields
    if (title !== undefined) update.title = title || null;
    if (subtitle !== undefined) update.subtitle = subtitle || null;
    if (alt_text !== undefined) update.alt_text = alt_text || null;
    if (link_url !== undefined) update.link_url = link_url || null;
    if (button_text !== undefined) update.button_text = button_text || null;
    if (sort_order !== undefined) update.sort_order = Number(sort_order);
    if (active !== undefined) update.active = String(active).toLowerCase() !== 'false';

    // Check if sort_order conflicts with another banner (if sort_order is being updated)
    if (update.sort_order !== undefined) {
      const existing = await BannerImage.findOne({ 
        location: 'homepage', 
        sort_order: update.sort_order,
        _id: { $ne: id }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Sort order ${update.sort_order} is already in use by another banner`
        });
      }
    }

    const banner = await BannerImage.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!banner) {
      return res.status(404).json({ 
        success: false,
        message: 'Banner image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Banner image updated successfully',
      banner
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a banner image
 * DELETE /api/admin/images/banners/:id
 */
exports.deleteBannerImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid banner image ID' 
      });
    }

    const banner = await BannerImage.findByIdAndDelete(id);

    if (!banner) {
      return res.status(404).json({ 
        success: false,
        message: 'Banner image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Banner image deleted successfully',
      deletedBanner: {
        id: banner._id,
        image_url: banner.image_url,
        sort_order: banner.sort_order
      }
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// COLLECTION IMAGES (Explore Our Collections)
// ============================================

/**
 * List all collection images with optional filtering
 * GET /api/admin/images/collections?category=engagement-rings&active=true&page=1&limit=50&sort=sort_order
 * Query params: category, active, page, limit, sort
 */
exports.getAllCollectionImages = async (req, res, next) => {
  try {
    const { category, active, page = 1, limit = 50, sort = 'sort_order' } = req.query;
    
    // Build filter
    const filter = {};
    if (category) {
      filter.category = category;
    }
    
    if (active !== undefined) {
      filter.active = String(active).toLowerCase() === 'true';
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Parse sort
    let sortOption = {};
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      sortOption[sortField] = sortOrder;
    } else {
      sortOption = { sort_order: 1 };
    }

    // Execute query
    const [images, total] = await Promise.all([
      CollectionImage.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select('-__v')
        .lean(),
      CollectionImage.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: images.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      images
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a specific collection image by ID
 * GET /api/admin/images/collections/:id
 */
exports.getCollectionImageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid collection image ID' 
      });
    }

    const image = await CollectionImage.findById(id).select('-__v');

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Collection image not found' 
      });
    }

    res.json({
      success: true,
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add collection image(s) - supports file uploads (form-data) or URLs
 * POST /api/admin/images/collections
 * 
 * Form-data options:
 *   - image: single file
 *   - images: multiple files (array)
 *   - image_url: single URL string
 *   - image_urls: array of URL strings
 * 
 * Required fields: category, display_text
 * Optional fields: alt_text, sort_order, metadata
 */
exports.addCollectionImages = async (req, res, next) => {
  try {
    // Parse form-data fields (multer puts them in req.body)
    const { 
      category, 
      display_text, 
      image_url, 
      image_urls, 
      alt_text, 
      sort_order,
      metadata 
    } = req.body;

    // Validate required fields
    if (!category || typeof category !== 'string' || category.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Category is required' 
      });
    }

    if (!display_text || typeof display_text !== 'string' || display_text.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Display text is required' 
      });
    }
    
    // Check for uploaded files (from multer)
    let files = [];
    if (req.files) {
      if (req.files.image && req.files.image.length > 0) {
        files.push(...req.files.image);
      }
      if (req.files.images && req.files.images.length > 0) {
        files.push(...req.files.images);
      }
    } else if (req.file) {
      files.push(req.file);
    }
    
    const hasFiles = files.length > 0;
    
    // Check for URLs
    let parsedImageUrls = image_urls;
    if (typeof image_urls === 'string') {
      try {
        parsedImageUrls = JSON.parse(image_urls);
      } catch {
        parsedImageUrls = image_urls.split(',').map(url => url.trim()).filter(Boolean);
      }
    }
    
    const hasSingleUrl = image_url && typeof image_url === 'string' && image_url.trim() !== '';
    const hasMultipleUrls = parsedImageUrls && Array.isArray(parsedImageUrls) && parsedImageUrls.length > 0;
    const hasUrls = hasSingleUrl || hasMultipleUrls;

    // Validate that at least one source is provided (files or URLs)
    if (!hasFiles && !hasUrls) {
      return res.status(400).json({ 
        success: false,
        message: 'Either upload image file(s) via form-data or provide image_url/image_urls' 
      });
    }

    const uploadedUrls = [];
    const errors = [];

    // Step 1: Upload files to Cloudinary if any
    if (hasFiles) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const result = await uploadBuffer(file.buffer, {
            folder: 'collections',
            resource_type: 'image',
            transformation: [
              { quality: 'auto', fetch_format: 'auto' }
            ]
          });
          uploadedUrls.push(result.secure_url);
        } catch (err) {
          errors.push({ 
            index: i, 
            filename: file.originalname, 
            error: `Failed to upload file: ${err.message}` 
          });
        }
      }
    }

    // Step 2: Collect URLs from request body
    const urlsFromBody = [];
    if (hasSingleUrl) {
      urlsFromBody.push(image_url.trim());
    }
    if (hasMultipleUrls) {
      urlsFromBody.push(...parsedImageUrls.filter(url => url && typeof url === 'string' && url.trim() !== '').map(url => url.trim()));
    }

    // Combine uploaded file URLs with provided URLs
    const urlsToAdd = [...uploadedUrls, ...urlsFromBody];

    // Validate that we have at least one valid URL
    if (urlsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid images were processed. Please check your file uploads or URLs.',
        errors
      });
    }
    
    // Get current max sort_order for this category (only once)
    const maxSortOrder = await CollectionImage.findOne({ 
      category: category.trim()
    })
      .sort({ sort_order: -1 })
      .select('sort_order');
    
    // Determine starting sort_order
    let startingSortOrder;
    if (sort_order !== undefined) {
      startingSortOrder = Number(sort_order);
      // Check if the provided sort_order conflicts with existing images
      const conflicting = await CollectionImage.findOne({ 
        category: category.trim(),
        sort_order: startingSortOrder 
      });
      if (conflicting) {
        startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
      }
    } else {
      startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
    }

    const createdImages = [];

    // Step 3: Process each URL (from files and/or provided URLs)
    for (let i = 0; i < urlsToAdd.length; i++) {
      const url = urlsToAdd[i];
      
      if (!url || typeof url !== 'string' || url.trim() === '') {
        errors.push({ index: i, url, error: 'Invalid URL' });
        continue;
      }

      try {
        // Calculate sort_order for this image (increment from starting point)
        const imageSortOrder = startingSortOrder + i;

        // Double-check for conflicts
        const existing = await CollectionImage.findOne({ 
          category: category.trim(),
          sort_order: imageSortOrder 
        });

        let finalSortOrder = imageSortOrder;
        if (existing) {
          const nextMax = await CollectionImage.findOne({ 
            category: category.trim()
          })
            .sort({ sort_order: -1 })
            .select('sort_order');
          finalSortOrder = nextMax ? nextMax.sort_order + 1 : 0;
        }
        
        // Parse metadata if provided as string
        let parsedMetadata = null;
        if (metadata !== undefined) {
          try {
            parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
          } catch {
            parsedMetadata = metadata;
          }
        }
        
        const image = new CollectionImage({
          category: category.trim(),
          image_url: url.trim(),
          display_text: display_text.trim(),
          alt_text: alt_text || `Collection image: ${display_text}`,
          sort_order: finalSortOrder,
          active: true,
          metadata: parsedMetadata
        });
        
        await image.save();
        createdImages.push(image);
      } catch (err) {
        errors.push({ index: i, url, error: err.message });
      }
    }

    if (createdImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create any collection images',
        errors
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdImages.length} collection image(s)`,
      created: createdImages.length,
      images: createdImages,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update/Replace a collection image
 * PUT /api/admin/images/collections/:id
 * 
 * Supports:
 *   - Form-data with 'image' file field (will upload to Cloudinary)
 *   - JSON body with image_url string
 *   - Other fields: category, display_text, alt_text, sort_order, active, metadata
 */
exports.updateCollectionImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid collection image ID' 
      });
    }

    const { 
      category,
      display_text,
      image_url, 
      alt_text, 
      sort_order, 
      active,
      metadata
    } = req.body;

    const update = {};
    
    // Handle image update: check for file upload first, then URL
    if (req.file) {
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'collections',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        update.image_url = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } else if (image_url !== undefined) {
      update.image_url = image_url.trim();
    }
    
    // Handle other fields
    if (category !== undefined) update.category = category.trim();
    if (display_text !== undefined) update.display_text = display_text.trim();
    if (alt_text !== undefined) update.alt_text = alt_text || null;
    if (sort_order !== undefined) update.sort_order = Number(sort_order);
    if (active !== undefined) update.active = String(active).toLowerCase() !== 'false';
    if (metadata !== undefined) {
      try {
        update.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch {
        update.metadata = metadata;
      }
    }

    // Check if sort_order conflicts with another image (if sort_order is being updated)
    if (update.sort_order !== undefined) {
      const filter = {
        category: update.category || (await CollectionImage.findById(id))?.category,
        sort_order: update.sort_order,
        _id: { $ne: id }
      };
      
      const existing = await CollectionImage.findOne(filter);
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Sort order ${update.sort_order} is already in use by another image in this category`
        });
      }
    }

    const image = await CollectionImage.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Collection image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Collection image updated successfully',
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a collection image
 * DELETE /api/admin/images/collections/:id
 */
exports.deleteCollectionImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid collection image ID' 
      });
    }

    const image = await CollectionImage.findByIdAndDelete(id);

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Collection image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Collection image deleted successfully',
      deletedImage: {
        id: image._id,
        category: image.category,
        image_url: image.image_url,
        display_text: image.display_text
      }
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// DIAMOND TYPE IMAGES (Lab Grown vs Natural)
// ============================================

/**
 * Get all diamond type images (always returns max 2: lab-grown and natural)
 * GET /api/admin/images/diamond-types
 */
exports.getAllDiamondTypeImages = async (req, res, next) => {
  try {
    const images = await DiamondTypeImage.find({})
      .sort({ diamond_type: 1 })
      .select('-__v')
      .lean();
    
    res.json({
      success: true,
      count: images.length,
      total: images.length,
      images
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a specific diamond type image by ID
 * GET /api/admin/images/diamond-types/:id
 */
exports.getDiamondTypeImageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid diamond type image ID' 
      });
    }

    const image = await DiamondTypeImage.findById(id).select('-__v');

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Diamond type image not found' 
      });
    }

    res.json({
      success: true,
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a specific diamond type image by type
 * GET /api/admin/images/diamond-types/type/:type
 * Type: 'lab-grown' or 'natural'
 */
exports.getDiamondTypeImageByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    
    if (type !== 'lab-grown' && type !== 'natural') {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid diamond type. Must be "lab-grown" or "natural"' 
      });
    }

    const image = await DiamondTypeImage.findOne({ diamond_type: type }).select('-__v');

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: `Diamond type image for "${type}" not found` 
      });
    }

    res.json({
      success: true,
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add or update diamond type image - supports file uploads (form-data) or URLs
 * POST /api/admin/images/diamond-types
 * 
 * Only 2 records allowed: 'lab-grown' and 'natural'
 * If record exists, it will be updated instead of creating duplicate
 * 
 * Form-data options:
 *   - image: file
 *   - image_url: URL string
 * 
 * Required fields: diamond_type, display_text
 * Optional fields: alt_text, active, metadata
 */
exports.addOrUpdateDiamondTypeImage = async (req, res, next) => {
  try {
    // Parse fields from req.body (works for both JSON and form-data)
    // For JSON: express.json() populates req.body
    // For form-data: multer populates req.body with text fields
    const body = req.body || {};
    const { 
      diamond_type, 
      display_text, 
      image_url, 
      alt_text, 
      active,
      metadata 
    } = body;
    
    // Debug logging (uncomment to troubleshoot)
    // console.log('=== DEBUG ===');
    // console.log('Content-Type:', req.get('content-type'));
    // console.log('req.body:', JSON.stringify(body, null, 2));
    // console.log('req.file:', req.file ? 'File exists' : 'No file');
    // console.log('image_url:', image_url);
    // console.log('================');

    // Validate required fields
    if (!diamond_type || typeof diamond_type !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: 'Diamond type is required and must be "lab-grown" or "natural"' 
      });
    }

    if (diamond_type !== 'lab-grown' && diamond_type !== 'natural') {
      return res.status(400).json({ 
        success: false,
        message: 'Diamond type must be either "lab-grown" or "natural"' 
      });
    }

    if (!display_text || typeof display_text !== 'string' || display_text.trim() === '') {
      return res.status(400).json({ 
        success: false,
        message: 'Display text is required' 
      });
    }
    
    // Check for uploaded file (from multer) or image_url
    // Supports both JSON and form-data
    let imageUrl = null;
    
    // Check for file upload first
    if (req.file) {
      // File was uploaded via form-data (field name: 'image')
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'diamond-types',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        imageUrl = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } 
    // Check for image_url in request body (works for both JSON and form-data)
    else {
      // Check if image_url exists in body (could be undefined, null, or empty string)
      const imageUrlValue = body.image_url;
      
      if (imageUrlValue !== undefined && imageUrlValue !== null && imageUrlValue !== '') {
        if (typeof imageUrlValue === 'string' && imageUrlValue.trim() !== '') {
          imageUrl = imageUrlValue.trim();
        } else {
          return res.status(400).json({ 
            success: false,
            message: 'image_url must be a non-empty string' 
          });
        }
      } else {
        // Neither file nor image_url provided
        return res.status(400).json({ 
          success: false,
          message: 'Either upload image file via form-data (field: "image") or provide image_url in request body (JSON or form-data text field)',
          debug: {
            hasFile: !!req.file,
            hasImageUrl: imageUrlValue !== undefined,
            imageUrlValue: imageUrlValue,
            contentType: req.get('content-type'),
            bodyKeys: Object.keys(body)
          }
        });
      }
    }

    // Parse metadata if provided as string
    let parsedMetadata = null;
    if (metadata !== undefined) {
      try {
        parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch {
        parsedMetadata = metadata;
      }
    }

    // Check if record already exists
    const existingImage = await DiamondTypeImage.findOne({ diamond_type });

    const updateData = {
      diamond_type,
      image_url: imageUrl,
      display_text: display_text.trim(),
      alt_text: alt_text || `Diamond type image: ${display_text}`,
      active: active !== undefined ? (String(active).toLowerCase() !== 'false') : true,
      metadata: parsedMetadata
    };

    let result;
    let isNew = false;

    if (existingImage) {
      // Update existing record
      result = await DiamondTypeImage.findByIdAndUpdate(
        existingImage._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } else {
      // Create new record
      result = new DiamondTypeImage(updateData);
      await result.save();
      isNew = true;
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew 
        ? `Diamond type image created successfully` 
        : `Diamond type image updated successfully`,
      created: isNew,
      image: result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update diamond type image by ID
 * PUT /api/admin/images/diamond-types/:id
 * 
 * Supports:
 *   - Form-data with 'image' or 'image_url' file field (will upload to Cloudinary)
 *   - JSON body with image_url string
 *   - Other fields: display_text, alt_text, active, metadata
 */
exports.updateDiamondTypeImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid diamond type image ID' 
      });
    }

    const { 
      display_text,
      image_url, 
      alt_text, 
      active,
      metadata
    } = req.body || {};

    const update = {};
    
    // Handle image update: check for file upload first, then URL
    if (req.file) {
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'diamond-types',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        update.image_url = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } else if (image_url !== undefined && image_url !== null && image_url !== '') {
      if (typeof image_url === 'string' && image_url.trim() !== '') {
        update.image_url = image_url.trim();
      } else {
        return res.status(400).json({
          success: false,
          message: 'image_url must be a non-empty string'
        });
      }
    }
    
    // Handle other fields
    if (display_text !== undefined) update.display_text = display_text.trim();
    if (alt_text !== undefined) update.alt_text = alt_text || null;
    if (active !== undefined) update.active = String(active).toLowerCase() !== 'false';
    if (metadata !== undefined) {
      try {
        update.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch {
        update.metadata = metadata;
      }
    }

    const image = await DiamondTypeImage.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Diamond type image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Diamond type image updated successfully',
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a diamond type image by ID
 * DELETE /api/admin/images/diamond-types/:id
 */
exports.deleteDiamondTypeImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid diamond type image ID' 
      });
    }

    const image = await DiamondTypeImage.findByIdAndDelete(id);

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Diamond type image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Diamond type image deleted successfully',
      deletedImage: {
        id: image._id,
        diamond_type: image.diamond_type,
        display_text: image.display_text
      }
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// FEATURED IMAGES (For every need and day)
// ============================================

/**
 * List all featured images with optional filtering
 * GET /api/admin/images/featured?active=true&page=1&limit=50&sort=sort_order
 * Query params: active, page, limit, sort
 */
exports.getAllFeaturedImages = async (req, res, next) => {
  try {
    const { active, page = 1, limit = 50, sort = 'sort_order' } = req.query;
    
    // Build filter
    const filter = {};
    if (active !== undefined) {
      filter.active = String(active).toLowerCase() === 'true';
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Parse sort
    let sortOption = {};
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      sortOption[sortField] = sortOrder;
    } else {
      sortOption = { sort_order: 1 };
    }

    // Execute query
    const [images, total] = await Promise.all([
      FeaturedImage.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select('-__v')
        .lean(),
      FeaturedImage.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: images.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      images
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a specific featured image by ID
 * GET /api/admin/images/featured/:id
 */
exports.getFeaturedImageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid featured image ID' 
      });
    }

    const image = await FeaturedImage.findById(id).select('-__v');

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Featured image not found' 
      });
    }

    res.json({
      success: true,
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add featured image(s) - supports file uploads (form-data) or URLs
 * POST /api/admin/images/featured
 * 
 * Form-data options:
 *   - image: single file
 *   - images: multiple files (array)
 *   - image_url: single URL string
 *   - image_urls: array of URL strings
 * 
 * Optional fields: display_text, alt_text, sort_order, metadata
 */
exports.addFeaturedImages = async (req, res, next) => {
  try {
    // Parse form-data fields (multer puts them in req.body)
    const body = req.body || {};
    const { 
      display_text,
      image_url, 
      image_urls, 
      alt_text, 
      sort_order,
      metadata 
    } = body;
    
    // Check for uploaded files (from multer)
    let files = [];
    if (req.files) {
      if (req.files.image && req.files.image.length > 0) {
        files.push(...req.files.image);
      }
      if (req.files.image_url && req.files.image_url.length > 0) {
        files.push(...req.files.image_url);
      }
      if (req.files.images && req.files.images.length > 0) {
        files.push(...req.files.images);
      }
    } else if (req.file) {
      files.push(req.file);
    }
    
    const hasFiles = files.length > 0;
    
    // Check for URLs
    let parsedImageUrls = image_urls;
    if (typeof image_urls === 'string') {
      try {
        parsedImageUrls = JSON.parse(image_urls);
      } catch {
        parsedImageUrls = image_urls.split(',').map(url => url.trim()).filter(Boolean);
      }
    }
    
    const hasSingleUrl = image_url && typeof image_url === 'string' && image_url.trim() !== '';
    const hasMultipleUrls = parsedImageUrls && Array.isArray(parsedImageUrls) && parsedImageUrls.length > 0;
    const hasUrls = hasSingleUrl || hasMultipleUrls;

    // Validate that at least one source is provided (files or URLs)
    if (!hasFiles && !hasUrls) {
      return res.status(400).json({ 
        success: false,
        message: 'Either upload image file(s) via form-data or provide image_url/image_urls' 
      });
    }

    const uploadedUrls = [];
    const errors = [];

    // Step 1: Upload files to Cloudinary if any
    if (hasFiles) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const result = await uploadBuffer(file.buffer, {
            folder: 'featured',
            resource_type: 'image',
            transformation: [
              { quality: 'auto', fetch_format: 'auto' }
            ]
          });
          uploadedUrls.push(result.secure_url);
        } catch (err) {
          errors.push({ 
            index: i, 
            filename: file.originalname, 
            error: `Failed to upload file: ${err.message}` 
          });
        }
      }
    }

    // Step 2: Collect URLs from request body
    const urlsFromBody = [];
    if (hasSingleUrl) {
      urlsFromBody.push(image_url.trim());
    }
    if (hasMultipleUrls) {
      urlsFromBody.push(...parsedImageUrls.filter(url => url && typeof url === 'string' && url.trim() !== '').map(url => url.trim()));
    }

    // Combine uploaded file URLs with provided URLs
    const urlsToAdd = [...uploadedUrls, ...urlsFromBody];

    // Validate that we have at least one valid URL
    if (urlsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid images were processed. Please check your file uploads or URLs.',
        errors
      });
    }
    
    // Get current max sort_order (only once)
    const maxSortOrder = await FeaturedImage.findOne({})
      .sort({ sort_order: -1 })
      .select('sort_order');
    
    // Determine starting sort_order
    let startingSortOrder;
    if (sort_order !== undefined) {
      startingSortOrder = Number(sort_order);
      // Check if the provided sort_order conflicts with existing images
      const conflicting = await FeaturedImage.findOne({ 
        sort_order: startingSortOrder 
      });
      if (conflicting) {
        startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
      }
    } else {
      startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
    }

    const createdImages = [];

    // Step 3: Process each URL (from files and/or provided URLs)
    for (let i = 0; i < urlsToAdd.length; i++) {
      const url = urlsToAdd[i];
      
      if (!url || typeof url !== 'string' || url.trim() === '') {
        errors.push({ index: i, url, error: 'Invalid URL' });
        continue;
      }

      try {
        // Calculate sort_order for this image (increment from starting point)
        const imageSortOrder = startingSortOrder + i;

        // Double-check for conflicts
        const existing = await FeaturedImage.findOne({ 
          sort_order: imageSortOrder 
        });

        let finalSortOrder = imageSortOrder;
        if (existing) {
          const nextMax = await FeaturedImage.findOne({})
            .sort({ sort_order: -1 })
            .select('sort_order');
          finalSortOrder = nextMax ? nextMax.sort_order + 1 : 0;
        }
        
        // Parse metadata if provided as string
        let parsedMetadata = null;
        if (metadata !== undefined) {
          try {
            parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
          } catch {
            parsedMetadata = metadata;
          }
        }
        
        const image = new FeaturedImage({
          image_url: url.trim(),
          display_text: display_text || undefined,
          alt_text: alt_text || `Featured image ${finalSortOrder + 1}`,
          sort_order: finalSortOrder,
          active: true,
          metadata: parsedMetadata
        });
        
        await image.save();
        createdImages.push(image);
      } catch (err) {
        errors.push({ index: i, url, error: err.message });
      }
    }

    if (createdImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create any featured images',
        errors
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdImages.length} featured image(s)`,
      created: createdImages.length,
      images: createdImages,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update/Replace a featured image
 * PUT /api/admin/images/featured/:id
 * 
 * Supports:
 *   - Form-data with 'image' or 'image_url' file field (will upload to Cloudinary)
 *   - JSON body with image_url string
 *   - Other fields: display_text, alt_text, sort_order, active, metadata
 */
exports.updateFeaturedImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid featured image ID' 
      });
    }

    const { 
      display_text,
      image_url, 
      alt_text, 
      sort_order, 
      active,
      metadata
    } = req.body || {};

    const update = {};
    
    // Handle image update: check for file upload first, then URL
    if (req.file) {
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'featured',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        update.image_url = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } else if (image_url !== undefined && image_url !== null && image_url !== '') {
      if (typeof image_url === 'string' && image_url.trim() !== '') {
        update.image_url = image_url.trim();
      } else {
        return res.status(400).json({
          success: false,
          message: 'image_url must be a non-empty string'
        });
      }
    }
    
    // Handle other fields
    if (display_text !== undefined) update.display_text = display_text || null;
    if (alt_text !== undefined) update.alt_text = alt_text || null;
    if (sort_order !== undefined) update.sort_order = Number(sort_order);
    if (active !== undefined) update.active = String(active).toLowerCase() !== 'false';
    if (metadata !== undefined) {
      try {
        update.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch {
        update.metadata = metadata;
      }
    }

    // Check if sort_order conflicts with another image (if sort_order is being updated)
    if (update.sort_order !== undefined) {
      const existing = await FeaturedImage.findOne({ 
        sort_order: update.sort_order,
        _id: { $ne: id }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Sort order ${update.sort_order} is already in use by another featured image`
        });
      }
    }

    const image = await FeaturedImage.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Featured image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Featured image updated successfully',
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a featured image
 * DELETE /api/admin/images/featured/:id
 */
exports.deleteFeaturedImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid featured image ID' 
      });
    }

    const image = await FeaturedImage.findByIdAndDelete(id);

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Featured image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Featured image deleted successfully',
      deletedImage: {
        id: image._id,
        image_url: image.image_url,
        display_text: image.display_text,
        sort_order: image.sort_order
      }
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// CUSTOMER REVIEW IMAGES
// ============================================

/**
 * List all customer review images with optional filtering
 * GET /api/admin/images/customer-reviews?active=true&page=1&limit=50&sort=sort_order
 * Query params: active, page, limit, sort
 */
exports.getAllCustomerReviewImages = async (req, res, next) => {
  try {
    const { active, page = 1, limit = 50, sort = 'sort_order' } = req.query;
    
    // Build filter
    const filter = {};
    if (active !== undefined) {
      filter.active = String(active).toLowerCase() === 'true';
    }

    // Parse pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Parse sort
    let sortOption = {};
    if (sort) {
      const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
      const sortOrder = sort.startsWith('-') ? -1 : 1;
      sortOption[sortField] = sortOrder;
    } else {
      sortOption = { sort_order: 1 };
    }

    // Execute query
    const [images, total] = await Promise.all([
      CustomerReviewImage.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .select('-__v')
        .lean(),
      CustomerReviewImage.countDocuments(filter)
    ]);

    res.json({
      success: true,
      count: images.length,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      images
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get a specific customer review image by ID
 * GET /api/admin/images/customer-reviews/:id
 */
exports.getCustomerReviewImageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid customer review image ID' 
      });
    }

    const image = await CustomerReviewImage.findById(id).select('-__v');

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Customer review image not found' 
      });
    }

    res.json({
      success: true,
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add customer review image(s) - supports file uploads (form-data) or URLs
 * POST /api/admin/images/customer-reviews
 * 
 * Form-data options:
 *   - image: single file
 *   - images: multiple files (array)
 *   - image_url: single URL string
 *   - image_urls: array of URL strings
 * 
 * Optional fields: display_text, alt_text, sort_order, metadata
 */
exports.addCustomerReviewImages = async (req, res, next) => {
  try {
    // Parse form-data fields (multer puts them in req.body)
    const body = req.body || {};
    const { 
      display_text,
      image_url, 
      image_urls, 
      alt_text, 
      sort_order,
      metadata 
    } = body;
    
    // Check for uploaded files (from multer)
    let files = [];
    if (req.files) {
      if (req.files.image && req.files.image.length > 0) {
        files.push(...req.files.image);
      }
      if (req.files.image_url && req.files.image_url.length > 0) {
        files.push(...req.files.image_url);
      }
      if (req.files.images && req.files.images.length > 0) {
        files.push(...req.files.images);
      }
    } else if (req.file) {
      files.push(req.file);
    }
    
    const hasFiles = files.length > 0;
    
    // Check for URLs
    let parsedImageUrls = image_urls;
    if (typeof image_urls === 'string') {
      try {
        parsedImageUrls = JSON.parse(image_urls);
      } catch {
        parsedImageUrls = image_urls.split(',').map(url => url.trim()).filter(Boolean);
      }
    }
    
    const hasSingleUrl = image_url && typeof image_url === 'string' && image_url.trim() !== '';
    const hasMultipleUrls = parsedImageUrls && Array.isArray(parsedImageUrls) && parsedImageUrls.length > 0;
    const hasUrls = hasSingleUrl || hasMultipleUrls;

    // Validate that at least one source is provided (files or URLs)
    if (!hasFiles && !hasUrls) {
      return res.status(400).json({ 
        success: false,
        message: 'Either upload image file(s) via form-data or provide image_url/image_urls' 
      });
    }

    const uploadedUrls = [];
    const errors = [];

    // Step 1: Upload files to Cloudinary if any
    if (hasFiles) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const result = await uploadBuffer(file.buffer, {
            folder: 'customer-reviews',
            resource_type: 'image',
            transformation: [
              { quality: 'auto', fetch_format: 'auto' }
            ]
          });
          uploadedUrls.push(result.secure_url);
        } catch (err) {
          errors.push({ 
            index: i, 
            filename: file.originalname, 
            error: `Failed to upload file: ${err.message}` 
          });
        }
      }
    }

    // Step 2: Collect URLs from request body
    const urlsFromBody = [];
    if (hasSingleUrl) {
      urlsFromBody.push(image_url.trim());
    }
    if (hasMultipleUrls) {
      urlsFromBody.push(...parsedImageUrls.filter(url => url && typeof url === 'string' && url.trim() !== '').map(url => url.trim()));
    }

    // Combine uploaded file URLs with provided URLs
    const urlsToAdd = [...uploadedUrls, ...urlsFromBody];

    // Validate that we have at least one valid URL
    if (urlsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid images were processed. Please check your file uploads or URLs.',
        errors
      });
    }
    
    // Get current max sort_order (only once)
    const maxSortOrder = await CustomerReviewImage.findOne({})
      .sort({ sort_order: -1 })
      .select('sort_order');
    
    // Determine starting sort_order
    let startingSortOrder;
    if (sort_order !== undefined) {
      startingSortOrder = Number(sort_order);
      // Check if the provided sort_order conflicts with existing images
      const conflicting = await CustomerReviewImage.findOne({ 
        sort_order: startingSortOrder 
      });
      if (conflicting) {
        startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
      }
    } else {
      startingSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0;
    }

    const createdImages = [];

    // Step 3: Process each URL (from files and/or provided URLs)
    for (let i = 0; i < urlsToAdd.length; i++) {
      const url = urlsToAdd[i];
      
      if (!url || typeof url !== 'string' || url.trim() === '') {
        errors.push({ index: i, url, error: 'Invalid URL' });
        continue;
      }

      try {
        // Calculate sort_order for this image (increment from starting point)
        const imageSortOrder = startingSortOrder + i;

        // Double-check for conflicts
        const existing = await CustomerReviewImage.findOne({ 
          sort_order: imageSortOrder 
        });

        let finalSortOrder = imageSortOrder;
        if (existing) {
          const nextMax = await CustomerReviewImage.findOne({})
            .sort({ sort_order: -1 })
            .select('sort_order');
          finalSortOrder = nextMax ? nextMax.sort_order + 1 : 0;
        }
        
        // Parse metadata if provided as string
        let parsedMetadata = null;
        if (metadata !== undefined) {
          try {
            parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
          } catch {
            parsedMetadata = metadata;
          }
        }
        
        const image = new CustomerReviewImage({
          image_url: url.trim(),
          display_text: display_text || undefined,
          alt_text: alt_text || `Customer review image ${finalSortOrder + 1}`,
          sort_order: finalSortOrder,
          active: true,
          metadata: parsedMetadata
        });
        
        await image.save();
        createdImages.push(image);
      } catch (err) {
        errors.push({ index: i, url, error: err.message });
      }
    }

    if (createdImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create any customer review images',
        errors
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdImages.length} customer review image(s)`,
      created: createdImages.length,
      images: createdImages,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update/Replace a customer review image
 * PUT /api/admin/images/customer-reviews/:id
 * 
 * Supports:
 *   - Form-data with 'image' or 'image_url' file field (will upload to Cloudinary)
 *   - JSON body with image_url string
 *   - Other fields: display_text, alt_text, sort_order, active, metadata
 */
exports.updateCustomerReviewImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid customer review image ID' 
      });
    }

    const { 
      display_text,
      image_url, 
      alt_text, 
      sort_order, 
      active,
      metadata
    } = req.body || {};

    const update = {};
    
    // Handle image update: check for file upload first, then URL
    if (req.file) {
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'customer-reviews',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        update.image_url = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } else if (image_url !== undefined && image_url !== null && image_url !== '') {
      if (typeof image_url === 'string' && image_url.trim() !== '') {
        update.image_url = image_url.trim();
      } else {
        return res.status(400).json({
          success: false,
          message: 'image_url must be a non-empty string'
        });
      }
    }
    
    // Handle other fields
    if (display_text !== undefined) update.display_text = display_text || null;
    if (alt_text !== undefined) update.alt_text = alt_text || null;
    if (sort_order !== undefined) update.sort_order = Number(sort_order);
    if (active !== undefined) update.active = String(active).toLowerCase() !== 'false';
    if (metadata !== undefined) {
      try {
        update.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch {
        update.metadata = metadata;
      }
    }

    // Check if sort_order conflicts with another image (if sort_order is being updated)
    if (update.sort_order !== undefined) {
      const existing = await CustomerReviewImage.findOne({ 
        sort_order: update.sort_order,
        _id: { $ne: id }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Sort order ${update.sort_order} is already in use by another customer review image`
        });
      }
    }

    const image = await CustomerReviewImage.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Customer review image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Customer review image updated successfully',
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a customer review image
 * DELETE /api/admin/images/customer-reviews/:id
 */
exports.deleteCustomerReviewImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid customer review image ID' 
      });
    }

    const image = await CustomerReviewImage.findByIdAndDelete(id);

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Customer review image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Customer review image deleted successfully',
      deletedImage: {
        id: image._id,
        image_url: image.image_url,
        display_text: image.display_text,
        sort_order: image.sort_order
      }
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// ENGAGEMENT RING BANNER (Only 1 record allowed)
// ============================================

/**
 * Get engagement ring banner image
 * GET /api/admin/images/engagement-ring-banner
 * Only one record exists, so returns single image or null
 */
exports.getEngagementRingBanner = async (req, res, next) => {
  try {
    const image = await EngagementRingBanner.findOne().select('-__v');

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Engagement ring banner image not found' 
      });
    }

    res.json({
      success: true,
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add or update engagement ring banner image (upsert - only 1 record allowed)
 * POST /api/admin/images/engagement-ring-banner
 * 
 * Supports:
 *   - Form-data with 'image' or 'image_url' file field (will upload to Cloudinary)
 *   - JSON body with image_url string
 *   - Other fields: display_text, alt_text, active, metadata
 * 
 * If record exists, it will be updated. If not, it will be created.
 */
exports.addOrUpdateEngagementRingBanner = async (req, res, next) => {
  try {
    // Parse fields from req.body (works for both JSON and form-data)
    const body = req.body || {};
    const { 
      display_text, 
      image_url, 
      alt_text, 
      active,
      metadata 
    } = body;
    
    // Check for uploaded file (from multer)
    let imageUrl = null;
    
    if (req.file) {
      // File was uploaded via form-data
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'engagement-ring-banner',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        imageUrl = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } else if (image_url !== undefined && image_url !== null && image_url !== '') {
      // Check for image_url in request body (works for both JSON and form-data)
      if (typeof image_url === 'string' && image_url.trim() !== '') {
        imageUrl = image_url.trim();
      } else {
        return res.status(400).json({ 
          success: false,
          message: 'image_url must be a non-empty string' 
        });
      }
    } else {
      // Check if record exists - if it does, we can update other fields without image_url
      const existing = await EngagementRingBanner.findOne();
      if (!existing) {
        // No record exists and no image provided
        return res.status(400).json({ 
          success: false,
          message: 'Either upload image file via form-data (field: "image" or "image_url") or provide image_url in request body (JSON or form-data text field)' 
        });
      }
      // Record exists, we can update other fields without changing image
      imageUrl = existing.image_url; // Keep existing image
    }

    // Parse metadata if provided as string
    let parsedMetadata = null;
    if (metadata !== undefined) {
      try {
        parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch {
        parsedMetadata = metadata;
      }
    }

    // Check if record already exists
    const existingImage = await EngagementRingBanner.findOne();
    
    const updateData = {
      image_url: imageUrl,
      display_text: display_text !== undefined ? (display_text || null) : undefined,
      alt_text: alt_text !== undefined ? (alt_text || null) : undefined,
      active: active !== undefined ? (String(active).toLowerCase() !== 'false') : true,
      metadata: parsedMetadata !== null ? parsedMetadata : undefined
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    let result;
    let isNew = false;

    if (existingImage) {
      // Update existing record
      result = await EngagementRingBanner.findByIdAndUpdate(
        existingImage._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } else {
      // Create new record
      result = new EngagementRingBanner({
        image_url: imageUrl,
        display_text: display_text || null,
        alt_text: alt_text || `Engagement ring banner`,
        active: active !== undefined ? (String(active).toLowerCase() !== 'false') : true,
        metadata: parsedMetadata
      });
      await result.save();
      isNew = true;
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew 
        ? `Engagement ring banner image created successfully` 
        : `Engagement ring banner image updated successfully`,
      created: isNew,
      image: result
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update engagement ring banner image
 * PUT /api/admin/images/engagement-ring-banner
 * 
 * Supports:
 *   - Form-data with 'image' or 'image_url' file field (will upload to Cloudinary)
 *   - JSON body with image_url string
 *   - Other fields: display_text, alt_text, active, metadata
 */
exports.updateEngagementRingBanner = async (req, res, next) => {
  try {
    const { 
      display_text,
      image_url, 
      alt_text, 
      active,
      metadata
    } = req.body || {};

    // Find existing record
    const existingImage = await EngagementRingBanner.findOne();

    if (!existingImage) {
      return res.status(404).json({ 
        success: false,
        message: 'Engagement ring banner image not found. Use POST to create it first.' 
      });
    }

    const update = {};
    
    // Handle image update: check for file upload first, then URL
    if (req.file) {
      try {
        const result = await uploadBuffer(req.file.buffer, {
          folder: 'engagement-ring-banner',
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        update.image_url = result.secure_url;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: `Failed to upload image: ${err.message}`
        });
      }
    } else if (image_url !== undefined && image_url !== null && image_url !== '') {
      if (typeof image_url === 'string' && image_url.trim() !== '') {
        update.image_url = image_url.trim();
      } else {
        return res.status(400).json({
          success: false,
          message: 'image_url must be a non-empty string'
        });
      }
    }
    
    // Handle other fields
    if (display_text !== undefined) update.display_text = display_text || null;
    if (alt_text !== undefined) update.alt_text = alt_text || null;
    if (active !== undefined) update.active = String(active).toLowerCase() !== 'false';
    if (metadata !== undefined) {
      try {
        update.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch {
        update.metadata = metadata;
      }
    }

    const image = await EngagementRingBanner.findByIdAndUpdate(
      existingImage._id,
      { $set: update },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Engagement ring banner image updated successfully',
      image
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete engagement ring banner image
 * DELETE /api/admin/images/engagement-ring-banner
 */
exports.deleteEngagementRingBanner = async (req, res, next) => {
  try {
    const image = await EngagementRingBanner.findOneAndDelete();

    if (!image) {
      return res.status(404).json({ 
        success: false,
        message: 'Engagement ring banner image not found' 
      });
    }

    res.json({
      success: true,
      message: 'Engagement ring banner image deleted successfully',
      deletedImage: {
        id: image._id,
        image_url: image.image_url,
        display_text: image.display_text
      }
    });
  } catch (err) {
    next(err);
  }
};

