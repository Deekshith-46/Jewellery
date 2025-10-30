const app = require('../src/app');
const connectDB = require('../src/config/db');

// Initialize database connection for serverless
let dbConnected = false;

// Serverless function handler
module.exports = async (req, res) => {
  try {
    // Ensure database is connected before handling request
    if (!dbConnected) {
      await connectDB();
      dbConnected = true;
    }
    
    // Handle the request
    return app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Service temporarily unavailable' : error.message
    });
  }
};


