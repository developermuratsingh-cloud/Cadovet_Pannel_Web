const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../database');

// A service photo uploaded from the operational head/admin's device. Public (served from app.js), unlike the
// documents upload — there's no per-customer privacy concern for a catalog photo.
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads/services');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (IMAGE_EXTENSIONS[file.mimetype] || '')),
});
const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => (IMAGE_EXTENSIONS[file.mimetype] ? cb(null, true) : cb(new Error('UNSUPPORTED_TYPE'))),
});

exports.uploadImageMiddleware = (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Image is too large (max 5 MB)' });
    if (err.message === 'UNSUPPORTED_TYPE') return res.status(400).json({ success: false, message: 'Only JPG, PNG, WEBP or GIF images are allowed' });
    return res.status(400).json({ success: false, message: 'Could not read the uploaded image' });
  });
};

// POST /api/services/upload-image  (multipart, field "image") — returns the URL to put in a service's image_url.
exports.uploadServiceImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image file received' });
  const url = `${req.protocol}://${req.get('host')}/uploads/services/${req.file.filename}`;
  res.status(201).json({ success: true, data: { url }, message: 'Image uploaded successfully' });
};

// emergency_price: a number >= 0, or null/'' for "not set" (the normal price applies in emergency hours).
// Returns { value } (null means not set) or { error }.
const parseEmergencyPrice = (raw) => {
  if (raw === null || raw === undefined || raw === '') return { value: null };
  const n = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 1000000) return { error: 'Emergency price must be a number between 0 and 1000000' };
  return { value: Math.round(n * 100) / 100 };
};

// GET /api/services
// Staff see every service, active or not — a deactivated one must stay findable so it can be edited or
// reactivated (see listPublicServices below for the customer-facing, active-only list).
exports.listServices = async (req, res) => {
  try {
    const { category, search } = req.query;
    let where = [];
    let params = [];
    let idx = 1;

    if (category && category !== 'ALL') {
      where.push(`category = $${idx++}`);
      params.push(category);
    }

    if (search) {
      where.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT * FROM services ${whereClause} ORDER BY category ASC, name ASC`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listServices error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// image_url: a string up to 500 chars, or null/'' for "no photo" (the public site falls back to a guessed
// stock photo when this is unset). Returns { value } or { error }.
const parseImageUrl = (raw) => {
  if (raw === null || raw === undefined || raw === '') return { value: null };
  if (typeof raw !== 'string') return { error: 'Image URL must be text' };
  const trimmed = raw.trim();
  if (trimmed.length > 500) return { error: 'Image URL must be at most 500 characters' };
  return { value: trimmed || null };
};

// A service is reachable on the public site at /product/:slug — derived from its name at creation time and
// kept stable after that (renaming a service later doesn't move its page). Collisions get a numeric suffix.
const slugify = (s) => String(s).toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 180) || 'service';

const uniqueSlug = async (base) => {
  let slug = base;
  let n = 2;
  while ((await db.query('SELECT 1 FROM services WHERE slug = $1', [slug])).rows.length) {
    slug = `${base}-${n++}`;
  }
  return slug;
};

// POST /api/services
exports.createService = async (req, res) => {
  try {
    const { name, category, description, price, duration_minutes } = req.body;
    if (!name || !category || price === undefined) {
      return res.status(400).json({ success: false, message: 'Name, category, and price are required' });
    }
    const emergency = parseEmergencyPrice(req.body.emergency_price);
    if (emergency.error) return res.status(400).json({ success: false, message: emergency.error });
    const image = parseImageUrl(req.body.image_url);
    if (image.error) return res.status(400).json({ success: false, message: image.error });
    const slug = await uniqueSlug(slugify(name));

    const result = await db.query(
      `INSERT INTO services (name, category, description, price, duration_minutes, emergency_price, image_url, slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, category, description || null, price, duration_minutes || 30, emergency.value, image.value, slug]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Service created successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PUT /api/services/:id
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, price, duration_minutes, is_active } = req.body;
    // Sending emergency_price (a number, or null/'' to clear it) changes it; leaving it out keeps the current value.
    const setEmergency = Object.prototype.hasOwnProperty.call(req.body, 'emergency_price');
    const emergency = parseEmergencyPrice(req.body.emergency_price);
    if (setEmergency && emergency.error) return res.status(400).json({ success: false, message: emergency.error });
    // Same pattern for image_url: sending it (including '' to clear it) changes it, omitting it keeps the current one.
    const setImage = Object.prototype.hasOwnProperty.call(req.body, 'image_url');
    const image = parseImageUrl(req.body.image_url);
    if (setImage && image.error) return res.status(400).json({ success: false, message: image.error });

    const result = await db.query(
      `UPDATE services SET
         name = COALESCE($1, name),
         category = COALESCE($2, category),
         description = COALESCE($3, description),
         price = COALESCE($4, price),
         duration_minutes = COALESCE($5, duration_minutes),
         is_active = COALESCE($6, is_active),
         emergency_price = CASE WHEN $8::boolean THEN $9::numeric ELSE emergency_price END,
         image_url = CASE WHEN $10::boolean THEN $11::varchar ELSE image_url END,
         updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, category, description, price, duration_minutes, is_active, id, setEmergency, setEmergency ? emergency.value : null, setImage, setImage ? image.value : null]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Service not found' });
    res.json({ success: true, data: result.rows[0], message: 'Service updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/services/public
exports.listPublicServices = async (req, res) => {
  try {
    const { category } = req.query;
    const params = category ? [category] : [];
    const categoryClause = category ? ' AND category = $1' : '';
    const result = await db.query(
      `SELECT * FROM services WHERE is_active = true${categoryClause} ORDER BY category ASC, name ASC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

