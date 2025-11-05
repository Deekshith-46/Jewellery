const express = require('express');
const router = express.Router();
const upload = require('../../middleware/upload');
const imageController = require('../../controllers/admin/imageController');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');

// Admin-only routes for image management
// All routes require authentication and admin privileges

// List all banner images with optional filtering
// GET /api/admin/images/banners?location=homepage&active=true&page=1&limit=50&sort=sort_order
// Query params: location, active, page, limit, sort
router.get('/banners', auth, admin, imageController.getAllBannerImages);

// Get a specific banner image by ID
// GET /api/admin/images/banners/:id
router.get('/banners/:id', auth, admin, imageController.getBannerImageById);

// POST route: supports both file uploads (form-data) and URLs (JSON/form-data)
// - Single file: field name 'image'
// - Multiple files: field name 'images' (array)
// - URLs: 'image_url' (string) or 'image_urls' (array)
router.post('/banners', 
  auth, 
  admin, 
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  imageController.addBannerImages
);

// PUT route: supports file upload (form-data) or URL (JSON/form-data)
// - File: field name 'image'
// - URL: 'image_url' in body
router.put('/banners/:id', 
  auth, 
  admin, 
  upload.single('image'),
  imageController.updateBannerImage
);

// Delete a specific banner image
// DELETE /api/admin/images/banners/:id
router.delete('/banners/:id', auth, admin, imageController.deleteBannerImage);

// ============================================
// COLLECTION IMAGES (Explore Our Collections)
// ============================================

// List all collection images with optional filtering
// GET /api/admin/images/collections?category=engagement-rings&active=true&page=1&limit=50&sort=sort_order
// Query params: category, active, page, limit, sort
router.get('/collections', auth, admin, imageController.getAllCollectionImages);

// Get a specific collection image by ID
// GET /api/admin/images/collections/:id
router.get('/collections/:id', auth, admin, imageController.getCollectionImageById);

// POST route: supports both file uploads (form-data) and URLs (JSON/form-data)
// - Single file: field name 'image'
// - Multiple files: field name 'images' (array)
// - URLs: 'image_url' (string) or 'image_urls' (array)
// Required: category, display_text
// Optional: alt_text, sort_order, metadata
router.post('/collections', 
  auth, 
  admin, 
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  imageController.addCollectionImages
);

// PUT route: supports file upload (form-data) or URL (JSON/form-data)
// - File: field name 'image'
// - URL: 'image_url' in body
// Other fields: category, display_text, alt_text, sort_order, active, metadata
router.put('/collections/:id', 
  auth, 
  admin, 
  upload.single('image'),
  imageController.updateCollectionImage
);

// Delete a specific collection image
// DELETE /api/admin/images/collections/:id
router.delete('/collections/:id', auth, admin, imageController.deleteCollectionImage);

// ============================================
// DIAMOND TYPE IMAGES (Lab Grown vs Natural)
// ============================================

// List all diamond type images (max 2: lab-grown and natural)
// GET /api/admin/images/diamond-types
router.get('/diamond-types', auth, admin, imageController.getAllDiamondTypeImages);

// Get a specific diamond type image by ID
// GET /api/admin/images/diamond-types/:id
router.get('/diamond-types/:id', auth, admin, imageController.getDiamondTypeImageById);

// Get a specific diamond type image by type (alternative route)
// GET /api/admin/images/diamond-types/type/:type (type: 'lab-grown' or 'natural')
router.get('/diamond-types/type/:type', auth, admin, imageController.getDiamondTypeImageByType);

// Add or update diamond type image (upsert - only 2 records allowed)
// POST /api/admin/images/diamond-types
// Supports both file uploads (form-data) and URLs (JSON/form-data)
// Required: diamond_type ('lab-grown' or 'natural'), display_text
// Optional: alt_text, active, metadata
// File field can be: 'image' or 'image_url' (both work)
router.post('/diamond-types', 
  auth, 
  admin, 
  upload.optional('image', 'image_url'),
  imageController.addOrUpdateDiamondTypeImage
);

// Update diamond type image by ID
// PUT /api/admin/images/diamond-types/:id
// Supports file upload (form-data) or URL (JSON/form-data)
// Other fields: display_text, alt_text, active, metadata
// File field can be: 'image' or 'image_url' (both work)
router.put('/diamond-types/:id', 
  auth, 
  admin, 
  upload.optional('image', 'image_url'),
  imageController.updateDiamondTypeImage
);

// Delete a diamond type image by ID
// DELETE /api/admin/images/diamond-types/:id
router.delete('/diamond-types/:id', auth, admin, imageController.deleteDiamondTypeImage);

// ============================================
// FEATURED IMAGES (For every need and day)
// ============================================

// List all featured images with optional filtering
// GET /api/admin/images/featured?active=true&page=1&limit=50&sort=sort_order
// Query params: active, page, limit, sort
router.get('/featured', auth, admin, imageController.getAllFeaturedImages);

// Get a specific featured image by ID
// GET /api/admin/images/featured/:id
router.get('/featured/:id', auth, admin, imageController.getFeaturedImageById);

// POST route: supports both file uploads (form-data) and URLs (JSON/form-data)
// - Single file: field name 'image' or 'image_url'
// - Multiple files: field name 'images' (array)
// - URLs: 'image_url' (string) or 'image_urls' (array)
// Optional: display_text, alt_text, sort_order, metadata
router.post('/featured', 
  auth, 
  admin, 
  upload.optionalFields([
    { name: 'image', maxCount: 1 },
    { name: 'image_url', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  imageController.addFeaturedImages
);

// PUT route: supports file upload (form-data) or URL (JSON/form-data)
// - File: field name 'image' or 'image_url'
// - URL: 'image_url' in body
// Other fields: display_text, alt_text, sort_order, active, metadata
router.put('/featured/:id', 
  auth, 
  admin, 
  upload.optional('image', 'image_url'),
  imageController.updateFeaturedImage
);

// Delete a specific featured image
// DELETE /api/admin/images/featured/:id
router.delete('/featured/:id', auth, admin, imageController.deleteFeaturedImage);

// ============================================
// CUSTOMER REVIEW IMAGES
// ============================================

// List all customer review images with optional filtering
// GET /api/admin/images/customer-reviews?active=true&page=1&limit=50&sort=sort_order
// Query params: active, page, limit, sort
router.get('/customer-reviews', auth, admin, imageController.getAllCustomerReviewImages);

// Get a specific customer review image by ID
// GET /api/admin/images/customer-reviews/:id
router.get('/customer-reviews/:id', auth, admin, imageController.getCustomerReviewImageById);

// POST route: supports both file uploads (form-data) and URLs (JSON/form-data)
// - Single file: field name 'image' or 'image_url'
// - Multiple files: field name 'images' (array)
// - URLs: 'image_url' (string) or 'image_urls' (array)
// Optional: display_text, alt_text, sort_order, metadata
router.post('/customer-reviews', 
  auth, 
  admin, 
  upload.optionalFields([
    { name: 'image', maxCount: 1 },
    { name: 'image_url', maxCount: 1 },
    { name: 'images', maxCount: 10 }
  ]),
  imageController.addCustomerReviewImages
);

// PUT route: supports file upload (form-data) or URL (JSON/form-data)
// - File: field name 'image' or 'image_url'
// - URL: 'image_url' in body
// Other fields: display_text, alt_text, sort_order, active, metadata
router.put('/customer-reviews/:id', 
  auth, 
  admin, 
  upload.optional('image', 'image_url'),
  imageController.updateCustomerReviewImage
);

// Delete a specific customer review image
// DELETE /api/admin/images/customer-reviews/:id
router.delete('/customer-reviews/:id', auth, admin, imageController.deleteCustomerReviewImage);

// ============================================
// ENGAGEMENT RING BANNER (Only 1 record allowed)
// ============================================

// Get engagement ring banner image
// GET /api/admin/images/engagement-ring-banner
router.get('/engagement-ring-banner', auth, admin, imageController.getEngagementRingBanner);

// Add or update engagement ring banner image (upsert - only 1 record allowed)
// POST /api/admin/images/engagement-ring-banner
// Supports both file uploads (form-data) and URLs (JSON/form-data)
// Required: image_url or file upload
// Optional: display_text, alt_text, active, metadata
// File field can be: 'image' or 'image_url' (both work)
// If record exists, it will be updated. If not, it will be created.
router.post('/engagement-ring-banner', 
  auth, 
  admin, 
  upload.optional('image', 'image_url'),
  imageController.addOrUpdateEngagementRingBanner
);

// Update engagement ring banner image
// PUT /api/admin/images/engagement-ring-banner
// Supports file upload (form-data) or URL (JSON/form-data)
// Other fields: display_text, alt_text, active, metadata
// File field can be: 'image' or 'image_url' (both work)
router.put('/engagement-ring-banner', 
  auth, 
  admin, 
  upload.optional('image', 'image_url'),
  imageController.updateEngagementRingBanner
);

// Delete engagement ring banner image
// DELETE /api/admin/images/engagement-ring-banner
router.delete('/engagement-ring-banner', auth, admin, imageController.deleteEngagementRingBanner);

module.exports = router;

