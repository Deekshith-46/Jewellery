const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

function getSignedUploadParams(extraParams = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { timestamp, ...extraParams };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    timestamp,
    signature
  };
}

module.exports = { cloudinary, getSignedUploadParams };

// Upload a Buffer to Cloudinary and return the secure_url
async function uploadBuffer(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

// Batch upload multiple images to Cloudinary (optimized for speed)
async function batchUploadImages(imageUrls, folder = 'products', batchSize = 5) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return [];
  
  const results = [];
  const errors = [];
  
  // Process in batches to avoid overwhelming Cloudinary
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (url, index) => {
      try {
        // Skip if already a Cloudinary URL
        if (url && url.includes('cloudinary.com')) {
          return url;
        }
        
        // Skip empty or invalid URLs
        if (!url || typeof url !== 'string' || url.trim() === '') {
          return null;
        }
        
        const result = await cloudinary.uploader.upload(url, {
          folder: folder,
          resource_type: 'auto',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        });
        return result.secure_url;
      } catch (error) {
        console.warn(`Failed to upload image ${url}:`, error.message);
        errors.push({ url, error: error.message });
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(Boolean));
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  if (errors.length > 0) {
    console.warn(`Batch upload completed with ${errors.length} errors:`, errors);
  }
  
  return results;
}

// Upload single image URL to Cloudinary
async function uploadImageUrl(imageUrl, folder = 'products') {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  
  try {
    // Check if it's already a Cloudinary URL
    if (imageUrl.includes('cloudinary.com')) return imageUrl;
    
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: folder,
      resource_type: 'auto',
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    return result.secure_url;
  } catch (error) {
    console.warn(`Failed to upload image ${imageUrl}:`, error.message);
    return null;
  }
}

module.exports.uploadBuffer = uploadBuffer;
module.exports.batchUploadImages = batchUploadImages;
module.exports.uploadImageUrl = uploadImageUrl;
