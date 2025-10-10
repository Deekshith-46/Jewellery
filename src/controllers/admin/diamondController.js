const DiamondSpec = require('../../models/admin/DiamondSpec');
const Shape = require('../../models/admin/Shape');
const XLSX = require('xlsx');

function toNumber(val) {
  if (val === null || val === undefined || val === '') return undefined;
  const s = String(val).toString();
  const match = s.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isNaN(n) ? undefined : n;
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = String(k).toLowerCase().replace(/\s|_/g, '');
    out[nk] = v;
  }
  return out;
}

function getVal(obj, keys) {
  for (const k of keys) {
    const nk = k.toLowerCase().replace(/\s|_/g, '');
    if (obj[nk] !== undefined && obj[nk] !== '') {
      const v = obj[nk];
      return typeof v === 'string' ? v.trim() : v;
    }
  }
  return undefined;
}

async function resolveShapeId(input) {
  if (!input) return undefined;
  const isId = require('mongoose').Types.ObjectId.isValid(input);
  if (isId) return input;
  const canon = String(input).trim().replace(/\s+/g, ' ');
  const byCode = await Shape.findOne({ code: new RegExp('^' + canon + '$', 'i') });
  if (byCode) return byCode._id;
  const byLabel = await Shape.findOne({ label: new RegExp('^' + canon + '$', 'i') });
  return byLabel ? byLabel._id : undefined;
}

async function ensureShapeId(input) {
  const existing = await resolveShapeId(input);
  if (existing) return existing;
  if (!input) return undefined;
  const codeRaw = String(input).trim();
  const codeCanonical = codeRaw.replace(/\s+/g, ' ').toUpperCase();
  const label = codeRaw
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
  try {
    const shape = await Shape.findOneAndUpdate(
      { code: codeCanonical },
      { $setOnInsert: { code: codeCanonical, label } },
      { new: true, upsert: true }
    );
    return shape._id;
  } catch (e) {
    const again = await Shape.findOne({ code: codeCanonical });
    return again ? again._id : undefined;
  }
}

exports.generateDiamonds = async (req, res, next) => {
  try {
    const { shapeId: shapeIdRaw, shape, carats = [], cuts = [], colors = [], clarities = [], basePricePerCarat = 0, labGrown = false } = req.body || {};
    const shapeId = shapeIdRaw || await resolveShapeId(shape);
    if (!shapeId) return res.status(400).json({ message: 'shapeId is required (or a resolvable shape code/label)' });

    const docs = [];
    for (const carat of carats) {
      for (const cut of cuts) {
        for (const color of colors) {
          for (const clarity of clarities) {
            const pricePerCarat = Number(basePricePerCarat) || 0;
            const price = Number((pricePerCarat * Number(carat)).toFixed(2));
            const sku = [String(shapeId).slice(-6), carat, cut, color, clarity].join('-');
            docs.push({ sku, shapeId, carat: Number(carat), cut, color, clarity, labGrown, price, stock: 1, available: true });
          }
        }
      }
    }
    if (!docs.length) return res.status(400).json({ message: 'No combinations provided' });
    const created = await DiamondSpec.insertMany(docs, { ordered: false });
    res.status(201).json({ created: created.length });
  } catch (err) { next(err); }
};

exports.bulkUploadDiamonds = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'file is required' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    const toDoc = async (raw) => {
      const row = normalizeRow(raw);
      const shape = getVal(row, ['shape', 'shapename', 'shapecode']);
      const shapeIdRaw = getVal(row, ['shapeid', 'shapeguid', 'shape_id']);
      const stockId = getVal(row, ['stock', 'stockid', 'stockno', 'stocknumber']);
      const availableRaw = getVal(row, ['available', 'isavailable']);
      const color = getVal(row, ['color', 'colour']);
      const clarity = getVal(row, ['purity', 'clarity']);
      const cut = getVal(row, ['cut']);
      const caratRaw = getVal(row, ['carat', 'caratweight', 'weight', 'size']);

      const map = {
        shape,
        shapeId: shapeIdRaw,
        stockId,
        available: (() => {
          const val = availableRaw === undefined ? 'true' : String(availableRaw).trim().toLowerCase();
          if (val === 'y' || val === 'yes' || val === '1' || val === 'true') return true;
          if (val === 'n' || val === 'no' || val === '0' || val === 'false') return false;
          return true;
        })(),
        location: getVal(row, ['location']),
        size: getVal(row, ['size']),
        sizeRange: getVal(row, ['sizerange', 'size-range']),
        color,
        purity: clarity,
        cut,
        polish: getVal(row, ['polish']),
        symmetry: getVal(row, ['sym', 'symmetry']),
        fluorescence: getVal(row, ['flou', 'fluo', 'fluor', 'fluoro', 'fluorescence']),
        measurement: getVal(row, ['measurement', 'measurements']),
        ratio: getVal(row, ['ratio']),
        lab: getVal(row, ['lab', 'laboratory']),
        pricePerCarat: toNumber(getVal(row, ['percarat', 'pricepercarat', 'ratepercarat', 'ppc'])),
        price: toNumber(getVal(row, ['price', 'amount'])),
        certificate: getVal(row, ['certnumber', 'certno', 'certificate', 'certnumber']),
        certificateUrl: getVal(row, ['certiurl', 'certificateurl', 'certurl']),
        tablePct: toNumber(getVal(row, ['table'])),
        crownHeight: toNumber(getVal(row, ['crownheight'])),
        pavilionDepth: toNumber(getVal(row, ['paviliondepth', 'paviliandepth'])),
        depthPct: toNumber(getVal(row, ['depth'])),
        crownAngle: toNumber(getVal(row, ['crownangle'])),
        pavilionAngle: toNumber(getVal(row, ['pavilionangle', 'paviliangle'])),
        comment: getVal(row, ['comment', 'remarks']),
        videoUrl: getVal(row, ['videourl', 'video']),
        imageUrl: getVal(row, ['imageurl', 'image']),
        carat: toNumber(caratRaw),
        stock: toNumber(getVal(row, ['stock', 'qty', 'quantity'])) || 1
      };
      const resolvedShapeId = map.shapeId || await ensureShapeId(map.shape);
      if (!resolvedShapeId) return null;
      const sku = (map.stockId && String(map.stockId).trim())
        || (map.certificate && String(map.certificate).trim())
        || [String(resolvedShapeId).slice(-6), map.carat || '0', map.cut || 'CUT', map.color || 'C', map.purity || 'CL'].join('-');
      return {
        sku,
        shapeId: resolvedShapeId,
        stockId: map.stockId,
        carat: map.carat,
        cut: map.cut || 'NA',
        color: map.color || 'NA',
        clarity: map.purity || 'NA',
        pricePerCarat: map.pricePerCarat,
        price: map.price,
        certificate: map.certificate,
        certificateUrl: map.certificateUrl,
        available: map.available,
        location: map.location,
        size: map.size,
        sizeRange: map.sizeRange,
        polish: map.polish,
        symmetry: map.symmetry,
        fluorescence: map.fluorescence,
        measurement: map.measurement,
        ratio: map.ratio,
        lab: map.lab,
        tablePct: map.tablePct,
        crownHeight: map.crownHeight,
        pavilionDepth: map.pavilionDepth,
        depthPct: map.depthPct,
        crownAngle: map.crownAngle,
        pavilionAngle: map.pavilionAngle,
        comment: map.comment,
        videoUrl: map.videoUrl,
        imageUrl: map.imageUrl,
        stock: map.stock
      };
    };

    const mapped = await Promise.all(sheet.map(toDoc));
    const totalRows = mapped.length;
    let docs = mapped.filter(d => d && d.shapeId && d.carat);
    if (!docs.length) return res.status(400).json({ message: 'No valid diamond rows found in sheet' });

    const seenSku = new Set();
    docs = docs.map((doc, idx) => {
      const base = (doc.stockId && String(doc.stockId).trim()) || (doc.certificate && String(doc.certificate).trim()) || doc.sku;
      let sku = String(base || doc.sku || '').trim();
      if (!sku) {
        sku = [String(doc.shapeId).slice(-6), doc.carat || '0', doc.cut || 'CUT', doc.color || 'C', doc.clarity || 'CL'].join('-');
      }
      let finalSku = sku;
      let n = 1;
      while (seenSku.has(finalSku)) {
        finalSku = `${sku}-${n++}`;
      }
      seenSku.add(finalSku);
      return { ...doc, sku: finalSku };
    });

    const ops = docs.map(d => ({
      updateOne: {
        filter: { sku: d.sku },
        update: { $setOnInsert: d },
        upsert: true
      }
    }));
    const result = await DiamondSpec.bulkWrite(ops, { ordered: false });
    const created = result.upsertedCount || 0;
    const skipped = (docs.length - created);
    res.status(201).json({ totalRows, validRows: docs.length, created, skipped });
  } catch (err) { next(err); }
};

exports.createDiamond = async (req, res, next) => {
  try {
    const d = new DiamondSpec(req.body);
    await d.save();
    res.status(201).json(d);
  } catch (err) { next(err); }
};

exports.updateDiamond = async (req, res, next) => {
  try {
    const d = await DiamondSpec.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!d) return res.status(404).json({ message: 'Not found' });
    res.json(d);
  } catch (err) { next(err); }
};

exports.deleteDiamond = async (req, res, next) => {
  try {
    const d = await DiamondSpec.findByIdAndDelete(req.params.id);
    if (!d) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};


