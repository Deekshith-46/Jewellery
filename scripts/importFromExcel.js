require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');

const connectDB = require('../config/db');
const Product = require('../models/admin/Product');
const Variant = require('../models/admin/Variant');
const Metal = require('../models/admin/Metal');
const Image = require('../models/admin/Image');

// Configuration
const EXCEL_FILE_PATH = path.join(__dirname, '..', '..', 'data', 'Products_freeze (1).xlsx');
const SHEET_NAME = 'Products'; // Adjust if your sheet has a different name

// Helper functions
const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(num) ? num : undefined;
};

const toBoolean = (value, defaultValue = false) => {
  if (value === '' || value === null || value === undefined) return defaultValue;
  const str = String(value).trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(str)) return true;
  if (['false', 'no', '0', 'n'].includes(str)) return false;
  return defaultValue;
};

const parseArray = (value) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return undefined;
};

const generateProductId = (productSku, productName, index) => {
  if (productSku) return productSku;
  if (productName) return `product-${String(productName).toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`;
  return `product-${Date.now()}-${index}`;
};

const generateVariantId = (productId, metalType, carat, shape) => {
  return `${productId}-${metalType || 'default'}-${carat || '0'}-${shape || 'default'}`;
};

const runImport = async () => {
  try {
    console.log('Starting Excel import...');
    
    // Connect to database
    await connectDB();
    console.log('Connected to MongoDB');

    // Read Excel file
    if (!require('fs').existsSync(EXCEL_FILE_PATH)) {
      console.error(`Excel file not found at: ${EXCEL_FILE_PATH}`);
      console.log('Please place your Excel file at the specified path or update EXCEL_FILE_PATH in the script');
      process.exit(1);
    }

    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    if (!workbook.Sheets[SHEET_NAME]) {
      console.error(`Sheet "${SHEET_NAME}" not found in Excel file`);
      console.log('Available sheets:', Object.keys(workbook.Sheets));
      process.exit(1);
    }

    const data = xlsx.utils.sheet_to_json(workbook.Sheets[SHEET_NAME], { defval: '' });
    console.log(`Found ${data.length} rows in Excel file`);

    if (data.length === 0) {
      console.log('No data to process');
      process.exit(0);
    }

    let productsCreated = 0;
    let productsUpdated = 0;
    let variantsCreated = 0;
    let metalsUpdated = 0;

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      console.log(`Processing row ${i + 1}/${data.length}`);

      // Extract data from Excel row
      const productSku = row.productSku || row.product_sku || row.SKU || '';
      const productName = row.product_name || row.productName || row.Name || '';
      const description = row.description || '';
      const metalType = row.metal_type || '';
      const shape = row.shape || '';
      const carat = toNumber(row.carat || row.carat_weight);
      const price = toNumber(row.price || row.metal_price);
      const stock = toNumber(row.stock) || 0;
      const readyToShip = toBoolean(row.readyToShip, false);
      const active = toBoolean(row.active, true);

      if (!productSku && !productName) {
        console.log(`Skipping row ${i + 1}: No productSku or productName`);
        continue;
      }

      // Generate product ID
      const productId = generateProductId(productSku, productName, i);

      // Create or update Product (clean data only)
      const productData = {
        productId,
        title: productName,
        sku_master: productSku || undefined,
        description: description || undefined,
        categories: parseArray(row.categories) || [],
        style: row.style || undefined,
        main_shape: shape || undefined,
        readyToShip,
        default_price: price || undefined,
        active,
        engravingAllowed: toBoolean(row.engravingAllowed, false)
      };

      // Remove undefined values
      Object.keys(productData).forEach(key => {
        if (productData[key] === undefined) delete productData[key];
      });

      const existingProduct = await Product.findOne({ productId });
      if (existingProduct) {
        await Product.updateOne({ productId }, { $set: productData });
        productsUpdated++;
        console.log(`Updated product: ${productId}`);
      } else {
        await Product.create(productData);
        productsCreated++;
        console.log(`Created product: ${productId}`);
      }

      // Create Variant if this row represents a sellable variant
      if (metalType && carat && price) {
        const variantSku = row.variant_sku || row.sku || `${productSku}-${metalType}-${carat}`;
        const variantId = generateVariantId(productId, metalType, carat, shape);

        const variantData = {
          variantId,
          productId,
          sku: variantSku,
          metal_type: metalType,
          carat: carat,
          shape: shape || undefined,
          diamond_type: row.diamond_type || undefined,
          price: price,
          stock: stock,
          readyToShip: readyToShip,
          weight_metal: toNumber(row.metal_weight),
          metal_cost: toNumber(row.metal_cost),
          active: active
        };

        // Remove undefined values
        Object.keys(variantData).forEach(key => {
          if (variantData[key] === undefined) delete variantData[key];
        });

        const existingVariant = await Variant.findOne({ variantId });
        if (!existingVariant) {
          await Variant.create(variantData);
          variantsCreated++;
          console.log(`Created variant: ${variantId}`);
        }
      }


      // Create Metal entries for pricing
      const metalRates = [];
      ['14k_rate', '18k_rate', 'platinum_rate'].forEach(key => {
        if (row[key]) {
          const metalType = key.replace('_rate', '');
          metalRates.push({
            metal_type: metalType,
            display_name: metalType,
            rate_per_gram: toNumber(row[key]),
            active: true
          });
        }
      });

      for (const metalData of metalRates) {
        const existingMetal = await Metal.findOne({ metal_type: metalData.metal_type });
        if (existingMetal) {
          // Update existing metal record with new rates
          await Metal.updateOne(
            { metal_type: metalData.metal_type }, 
            { 
              $set: { 
                rate_per_gram: metalData.rate_per_gram,
                price_multiplier: metalData.price_multiplier || 1
              } 
            }
          );
          metalsUpdated++;
          console.log(`Updated metal rates: ${metalData.metal_type} - ${metalData.rate_per_gram}/gram`);
        } else {
          // Create new metal record if it doesn't exist
          await Metal.create(metalData);
          metalsUpdated++;
          console.log(`Created metal: ${metalData.metal_type}`);
        }
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`Products created: ${productsCreated}`);
    console.log(`Products updated: ${productsUpdated}`);
    console.log(`Variants created: ${variantsCreated}`);
    console.log(`Metals updated: ${metalsUpdated}`);
    console.log('\nImport completed successfully!');

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

// Run the import
runImport();