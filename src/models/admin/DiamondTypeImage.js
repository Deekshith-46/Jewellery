const mongoose = require('mongoose');

const DiamondTypeImageSchema = new mongoose.Schema({
  // Diamond type: 'lab-grown' or 'natural'
  diamond_type: { 
    type: String, 
    required: true,
    enum: ['lab-grown', 'natural'],
    unique: true,
    index: true 
  },
  
  // Image URL (required)
  image_url: { 
    type: String, 
    required: true 
  },
  
  // Display text (e.g., "LAB GROWN DIAMONDS", "NATURAL DIAMONDS")
  display_text: { 
    type: String, 
    required: true 
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

// Index for efficient queries
DiamondTypeImageSchema.index({ diamond_type: 1, active: 1 });

module.exports = mongoose.model('DiamondTypeImage', DiamondTypeImageSchema);

