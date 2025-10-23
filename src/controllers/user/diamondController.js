// Import the admin diamond controller functions
const adminDiamondController = require('../admin/diamondController');

// Use the admin controller functions for public access
exports.fetchAllDiamonds = async (req, res, next) => {
  try {
    // Set available filter to true for public access (only show available diamonds)
    req.query.available = 'true';
    // Call the admin controller function
    await adminDiamondController.getAllDiamonds(req, res, next);
  } catch (err) {
    next(err);
  }
};

exports.getDiamondById = async (req, res, next) => {
  try {
    // Call the admin controller function
    await adminDiamondController.getDiamondById(req, res, next);
  } catch (err) {
    next(err);
  }
};

// Add filters endpoint for public access
exports.getDiamondFilters = async (req, res, next) => {
  try {
    // Call the admin controller function
    await adminDiamondController.getDiamondFilters(req, res, next);
  } catch (err) {
    next(err);
  }
};

// Debug endpoint to check diamond data
exports.debugDiamonds = async (req, res, next) => {
  try {
    const DiamondSpec = require('../../models/admin/DiamondSpec');
    
    const totalDiamonds = await DiamondSpec.countDocuments();
    const activeTrueDiamonds = await DiamondSpec.countDocuments({ active: true });
    const activeFalseDiamonds = await DiamondSpec.countDocuments({ active: false });
    const activeNullDiamonds = await DiamondSpec.countDocuments({ active: null });
    const activeMissingDiamonds = await DiamondSpec.countDocuments({ active: { $exists: false } });
    const availableTrueDiamonds = await DiamondSpec.countDocuments({ available: true });
    const availableFalseDiamonds = await DiamondSpec.countDocuments({ available: false });
    
    // Debug carat data
    const caratStats = await DiamondSpec.aggregate([
      {
        $group: {
          _id: null,
          minCarat: { $min: '$carat' },
          maxCarat: { $max: '$carat' },
          avgCarat: { $avg: '$carat' },
          count: { $sum: 1 },
          caratTypes: { $addToSet: { $type: '$carat' } }
        }
      }
    ]);
    
    // Get sample carat values
    const sampleCarats = await DiamondSpec.find({ carat: { $exists: true } })
      .select('sku carat')
      .limit(10)
      .lean();
    
    const sampleDiamonds = await DiamondSpec.find({}).limit(5).select('sku available active carat price').lean();
    
    res.json({
      totalDiamonds,
      activeBreakdown: {
        activeTrue: activeTrueDiamonds,
        activeFalse: activeFalseDiamonds,
        activeNull: activeNullDiamonds,
        activeMissing: activeMissingDiamonds,
        totalActive: activeTrueDiamonds + activeNullDiamonds + activeMissingDiamonds
      },
      availableBreakdown: {
        availableTrue: availableTrueDiamonds,
        availableFalse: availableFalseDiamonds
      },
      caratStats: caratStats[0] || {},
      sampleCarats,
      sampleDiamonds
    });
  } catch (err) {
    next(err);
  }
};


