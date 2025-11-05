const mongoose = require('mongoose');

const FeaturedImageSchema = new mongoose.Schema({
  // Image URL (required)
  image_url: { 
    type: String, 
    required: true 
  },
  
  // Display text (optional - e.g., "For every need and day")
  display_text: { 
    type: String 
  },
  
  // Alt text for accessibility
  alt_text: { type: String },
  
  // Sort order for display sequence
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
  
  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Index for efficient queries
FeaturedImageSchema.index({ sort_order: 1, active: 1 });

module.exports = mongoose.model('FeaturedImage', FeaturedImageSchema);

