const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const customerRoutes = require('./routes/customerRoutes');
const auditRoutes = require('./routes/auditRoutes');
const petRoutes = require('./routes/petRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const medicalRecordRoutes = require('./routes/medicalRecordRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const blogRoutes = require('./routes/blogRoutes');
const documentRoutes = require('./routes/documentRoutes');
const couponRoutes = require('./routes/couponRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const referralRoutes = require('./routes/referralRoutes');
const locationRoutes = require('./routes/locationRoutes');

const app = express();

// --- Production safety -------------------------------------------------------------------------------------------
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  // Without a strong secret anybody could mint admin tokens (the code falls back to a public default in development).
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters when NODE_ENV=production');
}

// CORS: CORS_ORIGIN may be one origin or a comma-separated list. In production an unset value means "no cross-origin
// browser access", and "*" is honoured but flagged, because the API is meant to be called from known sites only.
const corsSetting = process.env.CORS_ORIGIN;
let corsOrigin;
if (!corsSetting) corsOrigin = isProd ? false : '*';
else if (corsSetting === '*') { corsOrigin = '*'; if (isProd) console.warn('[security] CORS_ORIGIN=* in production: any website can call this API from a browser.'); }
else corsOrigin = corsSetting.split(',').map((o) => o.trim()).filter(Boolean);

// Security Middleware
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// In production never send internal error text (SQL errors, stack messages) to clients.
if (isProd) {
  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 500 && body && typeof body === 'object') {
        const { errors, ...rest } = body; // eslint-disable-line no-unused-vars
        return json(rest);
      }
      return json(body);
    };
    next();
  });
}

// Service images an operational head/admin uploads from their device — public, unlike the documents route
// (prescriptions etc.), since these are meant to be shown to any visitor on the website/app. Helmet's default
// Cross-Origin-Resource-Policy is same-origin, which would otherwise block the client app (a different origin
// in dev) from loading them, so it's relaxed for just this one static mount.
app.use('/uploads/services', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.resolve(__dirname, '../uploads/services')));

// Medicine-slip photos a pharmacy/inventory desk attaches to a dispense entry — internal (only ever linked to
// from the admin panel), but still served across origins the same way, and for the same reason: the panel is a
// different origin from the API in dev.
app.use('/uploads/inventory-slips', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.resolve(__dirname, '../uploads/inventory-slips')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/departments', permissionRoutes); // reuse for /departments endpoint
app.use('/api/customers', customerRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/membership-offers', membershipRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/locations', locationRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await require('./database').query('SELECT 1');
    res.json({ status: 'ok', db: 'up', time: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', time: new Date() });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found` });
});

// Global error handler. Client mistakes raised by middleware (malformed JSON, oversized body) are 4xx, not 500s.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  if (status >= 400 && status < 500) {
    const message = err.type === 'entity.too.large' ? 'Request body is too large'
      : err.type === 'entity.parse.failed' ? 'Malformed JSON in request body'
      : 'Bad request';
    return res.status(status).json({ success: false, message });
  }
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong on the server', ...(isProd ? {} : { errors: [err.message] }) });
});

module.exports = app;
