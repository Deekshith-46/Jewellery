/**
 * Script to manually drop the old productId_1 index from products collection
 * Run this with: node scripts/dropProductIdIndex.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const dropIndex = async () => {
  try {
    const MONGO_URI = process.env.MONGODB_URI?.replace(/^"(.*)"$/, '$1');
    
    if (!MONGO_URI) {
      console.error('❌ MONGODB_URI not found in environment variables');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const productsCollection = db.collection('products');

    // List all indexes first
    const indexes = await productsCollection.indexes();
    console.log('\n📋 Current indexes on products collection:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Drop the problematic index
    const indexToDrop = 'productId_1';
    try {
      await productsCollection.dropIndex(indexToDrop);
      console.log(`\n✅ Successfully dropped index: ${indexToDrop}`);
    } catch (err) {
      if (err.code === 27) {
        console.log(`\n⚠️  Index ${indexToDrop} does not exist (already dropped)`);
      } else {
        throw err;
      }
    }

    // Also try dropping other old indexes from products
    const oldProductIndexes = ['productId_1_active_1', 'slug_1', 'title_1'];
    for (const indexName of oldProductIndexes) {
      try {
        await productsCollection.dropIndex(indexName);
        console.log(`✅ Dropped index: ${indexName}`);
      } catch (err) {
        if (err.code !== 27) {
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }

    // Clean up variants collection
    const variantsCollection = db.collection('variants');
    console.log('\n🔍 Checking variants collection...');
    const variantIndexes = await variantsCollection.indexes();
    console.log('📋 Current indexes on variants collection:');
    variantIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const oldVariantIndexes = ['variant_sku_1', 'variant_sku_1_active_1', 'variantId_1', 'sku_1', 'variantSku_1'];
    for (const indexName of oldVariantIndexes) {
      try {
        await variantsCollection.dropIndex(indexName);
        console.log(`✅ Dropped index: ${indexName} from variants`);
      } catch (err) {
        if (err.code !== 27) {
          console.log(`⚠️  Could not drop ${indexName}:`, err.message);
        }
      }
    }

    // Clean up dyoexpandedvariants collection
    const dyoVariantsCollection = db.collection('dyoexpandedvariants');
    try {
      const dyoIndexes = await dyoVariantsCollection.indexes();
      console.log('\n📋 Current indexes on dyoexpandedvariants collection:');
      dyoIndexes.forEach(idx => {
        console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
      });

      const oldDYOIndexes = ['variant_sku_1', 'variant_sku_1_active_1', 'variantId_1', 'sku_1'];
      for (const indexName of oldDYOIndexes) {
        try {
          await dyoVariantsCollection.dropIndex(indexName);
          console.log(`✅ Dropped index: ${indexName} from dyoexpandedvariants`);
        } catch (err) {
          if (err.code !== 27) {
            console.log(`⚠️  Could not drop ${indexName}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.log(`⚠️  Could not access dyoexpandedvariants collection:`, err.message);
    }

    // Show final indexes
    const finalProductIndexes = await productsCollection.indexes();
    console.log('\n📋 Final indexes on products collection:');
    finalProductIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const finalVariantIndexes = await variantsCollection.indexes();
    console.log('\n📋 Final indexes on variants collection:');
    finalVariantIndexes.forEach(idx => {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ Index cleanup completed!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

dropIndex();

