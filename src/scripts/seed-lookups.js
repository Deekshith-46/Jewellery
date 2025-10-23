require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Style = require('../models/admin/Style');
const Shape = require('../models/admin/Shape');
const Metal = require('../models/admin/Metal');
const Category = require('../models/admin/Category');
const User = require('../models/user/User');
const { STYLE_NAMES, SHAPE_TYPES, METAL_TYPES, CATEGORIES_ENUM } = require('../models/admin/enums');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    await connectDB();
    for (const name of STYLE_NAMES) {
      await Style.updateOne({ code: name.toLowerCase() }, { code: name.toLowerCase(), name }, { upsert: true });
    }
    for (const s of SHAPE_TYPES) {
      await Shape.updateOne({ code: s }, { code: s, name: s }, { upsert: true });
    }
    for (const m of METAL_TYPES) {
      await Metal.updateOne({ code: m }, { code: m, name: m.replace(/_/g, ' ') }, { upsert: true });
    }
    for (const c of CATEGORIES_ENUM) {
      await Category.updateOne({ code: c }, { code: c, label: c }, { upsert: true });
    }

    // create admin if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPass = process.env.ADMIN_PASS || 'admin123';
    const existing = await User.findOne({ email: adminEmail });
    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(adminPass, salt);
      const user = new User({ firstName: 'Admin', lastName: 'User', email: adminEmail, password: hashed, role: 'admin' });
      await user.save();
      console.log('Admin user created:', adminEmail, adminPass);
    } else {
      console.log('Admin already exists:', adminEmail);
    }

    console.log('Seeding complete');
    process.exit(0);
  } catch (err) {
    console.error(err); process.exit(1);
  }
})();
