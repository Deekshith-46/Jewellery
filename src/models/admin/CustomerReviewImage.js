const mongoose = require('mongoose');

const CustomerReviewImageSchema = new mongoose.Schema({
  // Image URL (required)
  image_url: { 
    type: String, 
    required: true 
  },
  
  // Display text (optional - e.g., customer name or review quote)
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
  
  // Additional metadata (e.g., customer name, review text, rating)
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Index for efficient queries
CustomerReviewImageSchema.index({ sort_order: 1, active: 1 });

module.exports = mongoose.model('CustomerReviewImage', CustomerReviewImageSchema);
