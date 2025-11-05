const mongoose = require('mongoose');

const BannerImageSchema = new mongoose.Schema({
  // Image location/type identifier (e.g., 'homepage', 'about', 'contact')
  location: { 
    type: String, 
    required: true, 
    default: 'homepage',
    index: true 
  },
  
  // Image URL (required)
  image_url: { 
    type: String, 
    required: true 
  },
  
  // Text overlay fields (optional)
  title: { type: String }, // e.g., "Diamond Rings"
  subtitle: { type: String }, // e.g., "Specially Crafted for style and elegance"
  
  // Alt text for accessibility
  alt_text: { type: String },
  
  // Sort order for display sequence (0, 1, 2 for homepage banners)
  sort_order: { 
    type: Number, 
    default: 0,
    index: true 
  },
  
  // Status
  active: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  
  // Link URL (optional - if banner should link somewhere)
  link_url: { type: String },
  
  // Button text (optional - if banner has a CTA button)
  button_text: { type: String }
}, { timestamps: true });

// Compound index for efficient queries by location and sort order
BannerImageSchema.index({ location: 1, sort_order: 1 });
BannerImageSchema.index({ location: 1, active: 1 });

// Ensure unique sort_order per location (optional constraint)
// This prevents duplicate positions but allows flexibility
BannerImageSchema.index({ location: 1, sort_order: 1 }, { unique: true });

module.exports = mongoose.model('BannerImage', BannerImageSchema);

