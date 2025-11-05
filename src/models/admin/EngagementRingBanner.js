const mongoose = require('mongoose');

const EngagementRingBannerSchema = new mongoose.Schema({
  // Image URL (required)
  image_url: { 
    type: String, 
    required: true 
  },
  
  // Display text (optional - e.g., "Exclusive Engagement Rings")
  display_text: { 
    type: String 
  },
  
  // Alt text for accessibility
  alt_text: { type: String },
  
  // Status
  active: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  
  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Ensure only one record exists - use a constant identifier
EngagementRingBannerSchema.index({ active: 1 });

module.exports = mongoose.model('EngagementRingBanner', EngagementRingBannerSchema);

