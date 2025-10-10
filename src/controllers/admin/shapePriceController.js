const Shape = require('../../models/admin/Shape');

exports.setPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    if (price === undefined || Number.isNaN(Number(price))) {
      return res.status(400).json({ message: 'price number required' });
    }
    const doc = await Shape.findByIdAndUpdate(id, { price: Number(price) }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Shape not found' });
    res.json(doc);
  } catch (err) { next(err); }
};

exports.deletePrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await Shape.findByIdAndUpdate(id, { $unset: { price: 1 } }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Shape not found' });
    res.json(doc);
  } catch (err) { next(err); }
};


