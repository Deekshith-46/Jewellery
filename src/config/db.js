const mongoose = require('mongoose');

let MONGO_URI = process.env.MONGODB_URI;
// strip surrounding quotes if present (some .env values include them)
MONGO_URI = MONGO_URI.replace(/^"(.*)"$/, '$1');

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      dbName: undefined,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
