const mongoose = require('mongoose');

const CollectionImageSchema = new mongoose.Schema({
  // Category name (e.g., 'engagement-rings', 'bracelet', 'necklace', 'diamonds', 'fine-jewellery')
  category: { 
    type: String, 
    required: true, 
    index: true 
  },
  
  // Image URL (required)
  image_url: { 
    type: String, 
    required: true 
  },
  
  // Display text (category name to show)
  display_text: { 
    type: String, 
    required: true 
  }, // e.g., "Engagement Rings", "Bracelet"
  
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

// Compound indexes for efficient queries
CollectionImageSchema.index({ category: 1, sort_order: 1 });
CollectionImageSchema.index({ category: 1, active: 1 });

module.exports = mongoose.model('CollectionImage', CollectionImageSchema);

