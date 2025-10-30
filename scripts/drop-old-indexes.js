/**
 * Script to drop old/invalid indexes from MongoDB collections
 * Run this when you get duplicate key errors for fields that don't exist in your schema
 * 
 * Usage: node scripts/drop-old-indexes.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function dropOldIndexes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sample_Jewellery';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Drop old index from Variants collection
    console.log('\n🔍 Checking Variants collection indexes...');
    const variantsCollection = db.collection('variants');
    const variantIndexes = await variantsCollection.indexes();
    
    console.log('Current indexes:', variantIndexes.map(idx => idx.name));

    // Drop old variant indexes
    const oldVariantIndexes = ['variantId_1', 'sku_1', 'variantSku_1'];
    for (const indexName of oldVariantIndexes) {
      try {
        await variantsCollection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName}`);
      } catch (err) {
        if (err.code === 27) {
          console.log(`ℹ️  Index ${indexName} does not exist (already cleaned)`);
        } else {
          console.log(`⚠️  Error dropping ${indexName}:`, err.message);
        }
      }
    }

    // Check Metals collection for old indexes
    console.log('\n🔍 Checking Metals collection indexes...');
    const metalsCollection = db.collection('metals');
    const metalIndexes = await metalsCollection.indexes();
    
    console.log('Current indexes:', metalIndexes.map(idx => idx.name));

    // Drop old metal indexes
    const oldMetalIndexes = ['code_1', 'name_1'];
    for (const indexName of oldMetalIndexes) {
      try {
        await metalsCollection.dropIndex(indexName);
        console.log(`✅ Dropped old index: ${indexName}`);
      } catch (err) {
        if (err.code === 27) {
          console.log(`ℹ️  Index ${indexName} does not exist (already cleaned)`);
        } else {
          console.log(`⚠️  Error dropping ${indexName}:`, err.message);
        }
      }
    }

    // Check Products collection for old indexes
    console.log('\n🔍 Checking Products collection indexes...');
    const productsCollection = db.collection('products');
    const productIndexes = await productsCollection.indexes();
    
    console.log('Current indexes:', productIndexes.map(idx => idx.name));

    console.log('\n✅ Index cleanup completed!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

dropOldIndexes();

