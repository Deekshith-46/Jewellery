require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
connectDB();

// register models
require('./models/user');
require('./models/admin');

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// basic health endpoints
app.get('/', (req, res) => res.json({ ok: true, service: 'jewellery-backend' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

// user routes
app.use('/api/auth', require('./routes/user/auth'));
app.use('/api/products', require('./routes/user/products'));
app.use('/api/diamonds', require('./routes/user/diamonds'));
app.use('/api/orders', require('./routes/user/orders'));
app.use('/api/wishlist', require('./routes/user/wishlist'));
app.use('/api/addresses', require('./routes/user/addresses'));

// admin routes
app.use('/api/admin/auth', require('./routes/admin/auth'));
app.use('/api/admin/products', require('./routes/admin/products'));
app.use('/api/admin/diamonds', require('./routes/admin/diamonds'));
app.use('/api/admin/orders', require('./routes/admin/orders'));

// error handler (last)
app.use(errorHandler);

module.exports = app;


