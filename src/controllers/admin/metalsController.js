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

// Update metal
exports.updateMetal = async (req, res, next) => {
  try {
    const { metal_type } = req.params;
    const updateData = req.body;

    // Try to find by metal_type first, then by ID
    let metal = await Metal.findOne({ metal_type });
    if (!metal) {
      metal = await Metal.findById(metal_type);
    }
    
    if (!metal) {
      return res.status(404).json({ message: 'Metal not found' });
    }

    Object.assign(metal, updateData);
    await metal.save();

    res.json(metal);
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
