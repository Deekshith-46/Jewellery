const Contact = require('../../models/user/Contact');

exports.submitContact = async (req, res, next) => {
  try {
    const c = new Contact(req.body);
    await c.save();
    res.status(201).json(c);
  } catch (err) { next(err); }
};


