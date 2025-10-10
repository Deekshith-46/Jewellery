const DiamondSpec = require('../../models/admin/DiamondSpec');
const Shape = require('../../models/admin/Shape');

exports.getDiamondById = async (req, res, next) => {
  try {
    const d = await DiamondSpec.findById(req.params.id).populate('shapeId');
    if (!d) return res.status(404).json({ message: 'Not found' });
    res.json(d);
  } catch (err) { next(err); }
};

exports.fetchAllDiamonds = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      // carat range
      minCarat, maxCarat, caratMin, caratMax,
      // price range
      minPrice, maxPrice, priceMin, priceMax,
      // categorical
      location, // expected 'labGrown' or 'natural'
      clarity, clarities,
      color, colors,
      cut, cuts,
      shape, shapes,
      // sorting
      sort = '-createdAt'
    } = req.query;

    const filter = {};

    const cMin = Number(caratMin ?? minCarat);
    const cMax = Number(caratMax ?? maxCarat);
    if (!Number.isNaN(cMin)) filter.carat = { ...(filter.carat || {}), $gte: cMin };
    if (!Number.isNaN(cMax)) filter.carat = { ...(filter.carat || {}), $lte: cMax };

    const pMin = Number(priceMin ?? minPrice);
    const pMax = Number(priceMax ?? maxPrice);
    if (!Number.isNaN(pMin)) filter.price = { ...(filter.price || {}), $gte: pMin };
    if (!Number.isNaN(pMax)) filter.price = { ...(filter.price || {}), $lte: pMax };

    if (location) {
      const loc = String(location).trim().toLowerCase().replace(/\s+/g, '');
      if (loc === 'labgrown') {
        const rx = /lab\W*\s*grown/i;
        filter.$or = (filter.$or || []).concat([{ location: rx }, { lab: rx }]);
      } else if (loc === 'natural') {
        const rx = /natural/i;
        filter.$or = (filter.$or || []).concat([{ location: rx }, { lab: rx }]);
      }
    }

    const toList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => s.trim()).filter(Boolean);

    if (clarities || clarity) {
      const list = toList(clarities ?? clarity);
      if (list.length) filter.clarity = { $in: list };
    }
    if (colors || color) {
      const list = toList(colors ?? color);
      if (list.length) filter.color = { $in: list };
    }
    if (cuts || cut) {
      const list = toList(cuts ?? cut);
      if (list.length) filter.cut = { $in: list };
    }

    if (shapes || shape) {
      const rawList = toList(shapes ?? shape);
      const mongoose = require('mongoose');
      const ids = [];
      const names = [];
      for (const s of rawList) {
        if (mongoose.Types.ObjectId.isValid(s)) ids.push(s);
        else names.push(s);
      }
      const byNames = names.length
        ? await Shape.find({ $or: [
            { code: { $in: names.map(n => new RegExp('^' + n + '$', 'i')) } },
            { label: { $in: names.map(n => new RegExp('^' + n + '$', 'i')) } }
          ] }).select('_id')
        : [];
      const shapeIds = [...ids, ...byNames.map(d => d._id)];
      if (shapeIds.length || names.length) {
        const or = [];
        if (shapeIds.length) or.push({ shapeId: { $in: shapeIds } });
        if (names.length) or.push({ shape: { $in: names.map(n => new RegExp('^' + n + '$', 'i')) } });
        if (or.length) filter.$or = (filter.$or || []).concat(or);
      }
    }

    const sortSpec = {};
    String(sort).split(',').forEach(token => {
      const t = token.trim();
      if (!t) return;
      if (t.startsWith('-')) sortSpec[t.slice(1)] = -1; else sortSpec[t] = 1;
    });

    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 20, 100);

    const query = DiamondSpec.find(filter)
      .sort(sortSpec)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const [items, total] = await Promise.all([
      query.exec(),
      DiamondSpec.countDocuments(filter)
    ]);

    res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (err) { next(err); }
};


