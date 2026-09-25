const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());

app.use((req, res, next) => {
  if (req.path === '/api/payments/webhook') return next();
  express.json({ limit: '2mb' })(req, res, next);
});

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'dithar-backend' }));
app.use('/uploads', express.static(require('path').join(__dirname, '..', 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/addresses', require('./routes/addresses'));

app.use((req, res) => res.status(404).json({ error: 'المسار غير موجود' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'خطأ في الخادم' });
});

module.exports = app;
