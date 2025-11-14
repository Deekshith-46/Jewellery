const Contact = require('../../models/user/Contact');

// POST /api/contacts
exports.createContact = async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'name, email and message are required'
      });
    }

    const contact = await Contact.create({ name, email, phone, message });

    return res.status(201).json({
      success: true,
      contact
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/contacts/admin
exports.listContactsForAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [contacts, total] = await Promise.all([
      Contact.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Contact.countDocuments()
    ]);

    return res.json({
      success: true,
      contacts,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    next(err);
  }
};
