require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const connectDB = require('../config/db');

// Models
const Product = require('../models/admin/Product');
const ExpandedVariant = require('../models/admin/ExpandedVariant');
const DYOExpandedVariant = require('../models/admin/DYOExpandedVariant');
const VariantSummary = require('../models/admin/VariantSummary');

// Helpers
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

const toDate = (value) => {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
};

const toStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value).split(',').map(v => v.trim()).filter(Boolean);
};

const toNumberArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(v => toNumber(v)).filter(v => v !== undefined);
  return String(value).split(',').map(v => toNumber(v)).filter(v => v !== undefined);
};

const upsert = async (Model, where, data) => {
  await Model.updateOne(where, { $set: data }, { upsert: true });
};

// Main runner
const run = async () => {
  try {
    const excelPathArg = process.argv[2];
    const filePath = excelPathArg
      ? path.resolve(excelPathArg)
      : path.join(__dirname, '..', '..', 'data', 'products.xlsx');

    if (!fs.existsSync(filePath)) {
      console.error(`Excel file not found at: ${filePath}`);
      process.exit(1);
    }

    await connectDB();

    const workbook = xlsx.readFile(filePath);

    // 1) Products
    if (workbook.Sheets.Products) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets.Products, { defval: '' });
      for (const row of rows) {
        const data = {
          productSku: row.productSku,
          productName: row.productName,
          description: row.description || undefined,
          categories: row.categories || undefined,
          style: row.style || undefined,
          defaultShape: row.defaultShape || undefined,
          defaultMetalWeight: toNumber(row.defaultMetalWeight),
          defaultPrice: toNumber(row.defaultPrice),
          discountPercent: toNumber(row.discountPercent),
          imageUrl1: row.imageUrl1 || undefined,
          imageUrl2: row.imageUrl2 || undefined,
          readyToShip: toBoolean(row.readyToShip),
          engravingAllowed: toBoolean(row.engravingAllowed),
          active: toBoolean(row.active, true),
          lead_days: toNumber(row.lead_days),
          delivery_date: toDate(row.delivery_date)
        };
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await upsert(Product, { productSku: row.productSku }, data);
      }
      console.log(`Imported Products: ${xlsx.utils.sheet_to_json(workbook.Sheets.Products).length}`);
    }

    // 2) Variants (summary)
    if (workbook.Sheets.Variants) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets.Variants, { defval: '' });
      for (const row of rows) {
        const data = {
          productSku: row.productSku,
          variantSku: row.variantSku,
          metalTypes: toStringArray(row.metalTypes),
          availableShapes: toStringArray(row.availableShapes),
          metalWeight: toNumber(row.metalWeight),
          diamondType: row.diamondType || undefined,
          stock: toNumber(row.stock) || 0,
          centerStoneWeights: toNumberArray(row.centerStoneWeights),
          sideStoneWeights: toNumberArray(row.sideStoneWeights),
          active: toBoolean(row.active, true),
          readyToShip: toBoolean(row.readyToShip, false)
        };
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await upsert(VariantSummary, { variantSku: row.variantSku }, data);
      }
      console.log(`Imported Variant summaries: ${xlsx.utils.sheet_to_json(workbook.Sheets.Variants).length}`);
    }

    // 3) ExpandedVariants
    if (workbook.Sheets.ExpandedVariants) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets.ExpandedVariants, { defval: '' });
      for (const row of rows) {
        const data = {
          productSku: row.productSku,
          variantSku: row.variantSku,
          metalType: row.metalType,
          metalCode: row.metalCode || undefined,
          shape_code: row.shape_code || undefined,
          centerStoneWeight: toNumber(row.centerStoneWeight),
          centerStonePrice: toNumber(row.centerStonePrice),
          sideStoneWeight: toNumber(row.sideStoneWeight),
          sideStonePrice: toNumber(row.sideStonePrice),
          diamondType: row.diamondType || undefined,
          metalWeight: toNumber(row.metalWeight),
          metalBasePrice: toNumber(row.metalBasePrice),
          metalPrice: toNumber(row.metalPrice),
          stock: toNumber(row.stock) || 0,
          active: toBoolean(row.active, true),
          totalPrice: toNumber(row.totalPrice)
        };
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await upsert(ExpandedVariant, { variantSku: row.variantSku }, data);
      }
      console.log(`Imported ExpandedVariants: ${xlsx.utils.sheet_to_json(workbook.Sheets.ExpandedVariants).length}`);
    }

    // 4) DYOExpandedVariants
    if (workbook.Sheets.DYOExpandedVariants) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets.DYOExpandedVariants, { defval: '' });
      for (const row of rows) {
        const data = {
          productSku: row.productSku,
          variantSku: row.variantSku,
          productName: row.productName || undefined,
          metalType: row.metalType,
          metalCode: row.metalCode || undefined,
          shape_code: row.shape_code || undefined,
          metalWeight: toNumber(row.metalWeight),
          metalBasePrice: toNumber(row.metalBasePrice),
          metalPrice: toNumber(row.metalPrice),
          readyToShip: toBoolean(row.readyToShip, false),
          active: true
        };
        Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
        await upsert(DYOExpandedVariant, { variantSku: row.variantSku }, data);
      }
      console.log(`Imported DYOExpandedVariants: ${xlsx.utils.sheet_to_json(workbook.Sheets.DYOExpandedVariants).length}`);
    }

    console.log('Workbook import complete.');
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();


