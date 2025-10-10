const mongoose = require('mongoose');
const Product = require('../../models/admin/Product');
const Metal = require('../../models/admin/Metal');
const Style = require('../../models/admin/Style');
const Gemstone = require('../../models/admin/Gemstone');
const Shape = require('../../models/admin/Shape');
const Size = require('../../models/admin/Size');
require('../../models/admin/Category');
const XLSX = require('xlsx');
const slugify = require('slugify');

exports.createProductByAdmin = async (req, res, next) => {
  try {
    const body = { ...req.body };
    ['categoryId','styleId','gemstoneId','metalId','sizeId','diamondSpecId'].forEach(k => {
      if (body[k] === '') delete body[k];
    });
    const p = new Product(body);
    await p.save();
    res.status(201).json(p);
  } catch (err) { next(err); }
};

exports.deleteProductByAdmin = async (req, res, next) => {
  try {
    const doc = await Product.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

function norm(str) { return String(str || '').trim(); }
async function resolveRef(Model, queryKeys, value) {
  if (!value) return undefined;
  const v = norm(value);
  if (mongoose.Types.ObjectId.isValid(v)) {
    const doc = await Model.findById(v);
    if (doc) return doc._id;
  }
  const or = [];
  for (const key of queryKeys) {
    or.push({ [key]: new RegExp('^' + v + '$', 'i') });
  }
  const found = await Model.findOne({ $or: or });
  return found ? found._id : undefined;
}

exports.updateProductByAdmin = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });

    const update = { ...req.body };

    if (update.style || update.styleId) {
      update.styleId = await resolveRef(Style, ['code','name'], update.style ?? update.styleId) || update.styleId;
      delete update.style;
    }
    if (update.metal || update.metalId) {
      update.metalId = await resolveRef(Metal, ['code','name'], update.metal ?? update.metalId) || update.metalId;
      delete update.metal;
    }
    if (update.gemstone || update.gemstoneId) {
      update.gemstoneId = await resolveRef(Gemstone, ['code','name'], update.gemstone ?? update.gemstoneId) || update.gemstoneId;
      delete update.gemstone;
    }
    if (update.size || update.sizeId) {
      update.sizeId = await resolveRef(Size, ['value'], update.size ?? update.sizeId) || update.sizeId;
      delete update.size;
    }
    if (update.shape || update.shapeId) {
      update.shapeId = await resolveRef(Shape, ['code','label'], update.shape ?? update.shapeId) || update.shapeId;
      delete update.shape;
    }

    if (update.active !== undefined) update.active = String(update.active).toLowerCase() !== 'false';
    if (update.engravingAllowed !== undefined) update.engravingAllowed = String(update.engravingAllowed).toLowerCase() !== 'false';

    if (update.name) update.slug = slugify(update.name, { lower: true });

    const doc = await Product.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    res.json(doc);
  } catch (err) { next(err); }
};

const XLSXReaderNote = true;

exports.bulkUploadProducts = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'file is required' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

    const toDoc = async (row) => {
      const get = (k, alts=[]) => {
        const keys = [k, ...alts];
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== '') return row[key];
          const nk = String(key).toLowerCase().replace(/\s|_/g,'');
          for (const rk of Object.keys(row)) {
            if (String(rk).toLowerCase().replace(/\s|_/g,'') === nk) return row[rk];
          }
        }
        return '';
      };

      const name = get('name', ['product', 'product_name', 'title']);
      const description = get('description', ['desc']);
      const basePrice = Number(String(get('metal_pric', ['baseprice','price'])).replace(/[^0-9.]/g,'')) || undefined;
      const metalPrice = Number(String(get('metal_price', ['metalprice'])).replace(/[^0-9.]/g,'')) || undefined;
      const stock = Number(String(get('stock', ['qty', 'quantity'])).replace(/[^0-9.]/g,'')) || 0;
      const availability = get('availability', ['available']);
      const engravingAllowed = get('engraving_allowed', ['engravingallowed', 'engraving']);
      const engravingOptions = get('engraving_options', ['engravingoptions']);
      const category = get('category');
      const style = get('styles', ['style']);
      const metal = get('metal_types', ['metal','metaltype']);
      const gemstone = get('gemstone');
      const size = get('sizeId', ['size']);
      const shape = get('shape');

      const categoryId = await resolveRef(require('../../models/admin/Category'), ['code','label'], category);
      const styleId = await resolveRef(Style, ['code','name'], style);
      const metalId = await resolveRef(Metal, ['code','name'], metal);
      const gemstoneId = await resolveRef(Gemstone, ['code','name'], gemstone);
      const sizeId = await resolveRef(Size, ['value'], size);
      const shapeId = await resolveRef(Shape, ['code','label'], shape);

      const images = {
        card: norm(get('card_img', ['card_image'])),
        cardHover: norm(get('card_img_hover', ['card_image_hover'])),
        front: norm(get('front_img', ['front_image'])),
        top: norm(get('top_img', ['top_image'])),
        hand: norm(get('hand_img', ['hand_image'])),
        diamondSpec: norm(get('diamond_spec_img', ['diamond_spec_image']))
      };

      const doc = {
        name: name || `${style || 'Product'} ${metal || ''}`.trim(),
        description,
        basePrice,
        metalPrice,
        categoryId,
        styleId,
        metalId,
        gemstoneId,
        sizeId,
        shapeId,
        engravingAllowed: engravingAllowed ? String(engravingAllowed).toLowerCase() !== 'no' : true,
        engravingOptions: engravingOptions ? String(engravingOptions).trim() : '',
        active: availability ? String(availability).toLowerCase() !== 'no' : true,
        stock: stock,
        images,
        slug: name ? slugify(name, { lower: true }) : undefined
      };
      return doc;
    };

    const mapped = await Promise.all(sheet.map(toDoc));
    const docs = mapped.filter(d => d && d.name);
    if (!docs.length) return res.status(400).json({ message: 'No valid product rows found in sheet' });

    const seenSlugs = new Set();
    const docsWithUniqueSlugs = docs.map((doc, idx) => {
      let finalSlug = doc.slug;
      let counter = 1;
      while (seenSlugs.has(finalSlug)) {
        finalSlug = `${doc.slug}-${counter++}`;
      }
      seenSlugs.add(finalSlug);
      return { ...doc, slug: finalSlug };
    });

    const ops = docsWithUniqueSlugs.map(d => ({
      updateOne: {
        filter: {
          slug: d.slug
        },
        update: { $setOnInsert: d },
        upsert: true
      }
    }));
    const result = await Product.bulkWrite(ops, { ordered: false });
    const created = result.upsertedCount || 0;
    const skipped = (docsWithUniqueSlugs.length - created);
    res.status(201).json({ totalRows: sheet.length, validRows: docs.length, created, skipped });
  } catch (err) { next(err); }
};
