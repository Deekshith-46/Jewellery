const Metal = require('../../models/admin/Metal');

// Create metal
exports.createMetal = async (req, res, next) => {
  try {
    const metalData = req.body;
    const metal = new Metal(metalData);
    await metal.save();
    
    res.status(201).json(metal);
  } catch (err) {
    next(err);
  }
};

// List all metals
exports.listMetals = async (req, res, next) => {
  try {
    const { active = true, available = true } = req.query;
    
    const query = {};
    if (active !== undefined) query.active = active === 'true';
    if (available !== undefined) query.available = available === 'true';

    const metals = await Metal.find(query).sort({ metal_type: 1 });
    res.json(metals);
  } catch (err) {
    next(err);
  }
};

// Get metal by metal_type or ID
exports.getMetal = async (req, res, next) => {
  try {
    const { metal_type } = req.params;
    
    // Try to find by metal_type first, then by ID
    let metal = await Metal.findOne({ metal_type });
    if (!metal) {
      metal = await Metal.findById(metal_type);
    }
    
    if (!metal) {
      return res.status(404).json({ message: 'Metal not found' });
    }

    res.json(metal);
  } catch (err) {
    next(err);
  }
};

// Update metal (rate_per_gram, price_multiplier, etc.)
exports.updateMetal = async (req, res, next) => {
  try {
    const { metal_type } = req.params;
    const { rate_per_gram, price_multiplier, metal_code, active } = req.body;

    // Try to find by metal_type first, then by ID
    let metal = await Metal.findOne({ metal_type });
    if (!metal) {
      metal = await Metal.findById(metal_type);
    }
    
    if (!metal) {
      return res.status(404).json({ message: 'Metal not found' });
    }

    // Store old values for logging
    const oldValues = {
      rate_per_gram: metal.rate_per_gram,
      price_multiplier: metal.price_multiplier
    };

    // Update only provided fields
    if (rate_per_gram !== undefined) metal.rate_per_gram = Number(rate_per_gram);
    if (price_multiplier !== undefined) metal.price_multiplier = Number(price_multiplier);
    if (metal_code !== undefined) metal.metal_code = metal_code;
    if (active !== undefined) metal.active = Boolean(active);

    await metal.save();

    // Log the update
    console.log(`✅ Metal updated: ${metal_type}`);
    console.log(`   Rate per gram: ${oldValues.rate_per_gram} → ${metal.rate_per_gram}`);
    console.log(`   Price multiplier: ${oldValues.price_multiplier} → ${metal.price_multiplier}`);

    res.json({
      message: 'Metal updated successfully',
      metal,
      changes: {
        rate_per_gram: {
          old: oldValues.rate_per_gram,
          new: metal.rate_per_gram
        },
        price_multiplier: {
          old: oldValues.price_multiplier,
          new: metal.price_multiplier
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// Bulk update metals (for daily price updates)
exports.bulkUpdateMetals = async (req, res, next) => {
  try {
    const { metals } = req.body; // Array of { metal_type, rate_per_gram, price_multiplier }

    if (!Array.isArray(metals) || metals.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of metals to update' });
    }

    const results = {
      updated: 0,
      failed: 0,
      details: []
    };

    for (const metalData of metals) {
      try {
        const { metal_type, rate_per_gram, price_multiplier } = metalData;
        
        if (!metal_type) {
          results.failed++;
          results.details.push({ metal_type: 'unknown', status: 'failed', error: 'metal_type is required' });
          continue;
        }

        const metal = await Metal.findOne({ metal_type });
        
        if (!metal) {
          results.failed++;
          results.details.push({ metal_type, status: 'failed', error: 'Metal not found' });
          continue;
        }

        const oldRate = metal.rate_per_gram;
        const oldMultiplier = metal.price_multiplier;

        if (rate_per_gram !== undefined) metal.rate_per_gram = Number(rate_per_gram);
        if (price_multiplier !== undefined) metal.price_multiplier = Number(price_multiplier);

        await metal.save();

        results.updated++;
        results.details.push({
          metal_type,
          status: 'success',
          changes: {
            rate_per_gram: { old: oldRate, new: metal.rate_per_gram },
            price_multiplier: { old: oldMultiplier, new: metal.price_multiplier }
          }
        });

        console.log(`✅ Bulk update: ${metal_type} - Rate: ${oldRate} → ${metal.rate_per_gram}, Multiplier: ${oldMultiplier} → ${metal.price_multiplier}`);
      } catch (err) {
        results.failed++;
        results.details.push({ metal_type: metalData.metal_type, status: 'failed', error: err.message });
      }
    }

    res.json({
      message: `Bulk update completed: ${results.updated} succeeded, ${results.failed} failed`,
      ...results
    });
  } catch (err) {
    next(err);
  }
};

// Delete metal
exports.deleteMetal = async (req, res, next) => {
  try {
    const { metal_type } = req.params;

    // Try to find by metal_type first, then by ID
    let metal = await Metal.findOneAndDelete({ metal_type });
    if (!metal) {
      metal = await Metal.findByIdAndDelete(metal_type);
    }
    
    if (!metal) {
      return res.status(404).json({ message: 'Metal not found' });
    }

    res.json({ message: 'Metal deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Calculate price for custom build
exports.calculateCustomPrice = async (req, res, next) => {
  try {
    const { base_price = 0, metal_type, metal_weight = 0, diamond_price = 0, labor_cost = 0 } = req.body;
    
    let metalCost = 0;
    if (metal_type && metal_weight > 0) {
      const metal = await Metal.findOne({ metal_type, active: true });
      if (metal && metal.rate_per_gram) {
        metalCost = metal.rate_per_gram * metal_weight;
      }
    }

    const subtotal = Number(base_price) + metalCost + Number(diamond_price) + Number(labor_cost);
    const total = subtotal; // Add taxes, shipping etc. as needed

    res.json({ 
      total, 
      subtotal,
      breakdown: { 
        base_price: Number(base_price),
        metalCost, 
        diamond_price: Number(diamond_price),
        labor_cost: Number(labor_cost)
      } 
    });
  } catch (err) {
    next(err);
  }
};
