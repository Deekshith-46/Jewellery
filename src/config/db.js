const mongoose = require('mongoose');

let MONGO_URI = process.env.MONGODB_URI;
// strip surrounding quotes if present (some .env values include them)
if (MONGO_URI) {
  MONGO_URI = MONGO_URI.replace(/^"(.*)"$/, '$1');
}

// Helper function to drop old/invalid indexes
const dropOldIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    // Drop old indexes from Variants collection
    const variantsCollection = db.collection('variants');
    
    const oldVariantIndexes = ['variantId_1', 'sku_1', 'variantSku_1', 'product_1'];
    for (const indexName of oldVariantIndexes) {
      try {
        await variantsCollection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName} from variants collection`);
      } catch (err) {
        if (err.code !== 27) { // 27 = IndexNotFound
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }

    // Drop old indexes from Metals collection
    const metalsCollection = db.collection('metals');
    const oldMetalIndexes = ['code_1', 'name_1'];
    for (const indexName of oldMetalIndexes) {
      try {
        await metalsCollection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName} from metals collection`);
      } catch (err) {
        if (err.code !== 27) {
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }

    // Drop old indexes from Images collection
    const imagesCollection = db.collection('images');
    const oldImageIndexes = ['productId_1', 'variantId_1', 'productId_1_active_1', 'variantId_1_active_1', 'url_1', 'productSku_1_variant_sku_1_image_url_1'];
    for (const indexName of oldImageIndexes) {
      try {
        await imagesCollection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName} from images collection`);
      } catch (err) {
        if (err.code !== 27) {
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }

    // Drop old indexes from WishlistItems collection
    const wishlistCollection = db.collection('wishlistitems');
    const oldWishlistIndexes = ['userId_1_productId_1_diamondSpecId_1'];
    for (const indexName of oldWishlistIndexes) {
      try {
        await wishlistCollection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName} from wishlistitems collection`);
      } catch (err) {
        if (err.code !== 27) {
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }

    // Drop old indexes from Carts collection
    const cartsCollection = db.collection('carts');
    const oldCartIndexes = ['userId_1_updatedAt_-1'];
    for (const indexName of oldCartIndexes) {
      try {
        await cartsCollection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName} from carts collection`);
      } catch (err) {
        if (err.code !== 27) {
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }

  } catch (err) {
    console.log('⚠️  Index cleanup warning:', err.message);
  }
};

const connectDB = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }
    
    // Avoid multiple connections in serverless environment
    if (mongoose.connection.readyState >= 1) {
      console.log('MongoDB already connected');
      return;
    }
    
    await mongoose.connect(MONGO_URI, {
      dbName: undefined,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log('MongoDB connected');
    
    // Drop old indexes after connection (only if not in production/serverless)
    if (process.env.NODE_ENV !== 'production') {
      await dropOldIndexes();
    }
    
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // In serverless functions, throw error instead of process.exit()
    throw new Error(`Failed to connect to MongoDB: ${err.message}`);
  }
};

module.exports = connectDB;
