const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('../database');
const { getCustomerScope } = require('../utils/scope');
const { getStaffScope } = require('../utils/staffScope');
const { isPositiveInt } = require('../utils/slots');

// Non-customer roles allowed to view documents beyond their own uploads (a DOCTOR is scoped to their own
// patients below). ADMIN/OPERATIONAL_HEAD see every customer's, matching their existing oversight of
// appointments/pets. PHARMACY/INVENTORY (the desk roles) also need this — they read a prescription's medicines to
// know what to dispense — and, unlike inventory stock, prescriptions aren't department-scoped.
const OVERSIGHT_ROLES = ['ADMIN', 'OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY'];

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads/documents');
const MAX_BYTES = 10 * 1024 * 1024;
const CATEGORIES = ['PRESCRIPTION', 'LAB_REPORT', 'VACCINATION', 'OTHER'];
const EXTENSIONS = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heic',
};
const LINK_TTL = '5m';
const secret = () => process.env.JWT_SECRET || 'secret';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    cb(null, UPLOAD_ROOT);
  },
  // Random stored name: the client-supplied file name is never used on disk.
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (EXTENSIONS[file.mimetype] || '')),
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => (EXTENSIONS[file.mimetype] ? cb(null, true) : cb(new Error('UNSUPPORTED_TYPE'))),
});

exports.uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'File is too large (max 10 MB)' });
    if (err.message === 'UNSUPPORTED_TYPE') return res.status(400).json({ success: false, message: 'Only PDF, JPG, PNG, WEBP or HEIC files are allowed' });
    return res.status(400).json({ success: false, message: 'Could not read the uploaded file' });
  });
};

const removeFile = (storedName) => fs.promises.unlink(path.join(UPLOAD_ROOT, storedName)).catch(() => {});
exports.removeStoredFile = removeFile;
exports.UPLOAD_ROOT = UPLOAD_ROOT;

const toDto = (r) => ({
  id: r.id,
  category: r.category,
  title: r.title,
  notes: r.notes,
  original_name: r.original_name,
  mime_type: r.mime_type,
  size_bytes: r.size_bytes,
  pet_id: r.pet_id,
  pet_name: r.pet_name ?? null,
  customer_name: r.customer_name ?? undefined,
  uploaded_by_name: r.uploaded_by_name ?? undefined,
  created_at: r.created_at,
});

const requireCustomer = async (req, res) => {
  const scope = await getCustomerScope(req.user.id);
  if (!scope.isCustomer || !scope.customerId) {
    res.status(403).json({ success: false, message: 'Documents are available to customer accounts only' });
    return null;
  }
  return scope.customerId;
};

// Who is asking, and what they may reach. A CUSTOMER sees their own; a DOCTOR sees only their own patients'
// (mirrors the medical-records rule); everyone in OVERSIGHT_ROLES sees everything. Anyone else is not part of
// this feature.
const resolveAccess = async (req) => {
  const { isCustomer, customerId } = await getCustomerScope(req.user.id);
  if (isCustomer) return { mode: 'customer', customerId };
  const scope = await getStaffScope(req.user.id);
  if (scope.isDoctor) return { mode: 'doctor', doctorId: scope.doctorId };
  if (OVERSIGHT_ROLES.includes(scope.role)) return { mode: 'oversight' };
  return { mode: 'none' };
};

// GET /api/documents?category=&pet_id=&customer_id=
exports.listDocuments = async (req, res) => {
  try {
    const access = await resolveAccess(req);
    const { category, pet_id, customer_id } = req.query;
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: 'Invalid category' });

    const params = [];
    const where = [];
    if (access.mode === 'customer') {
      params.push(access.customerId);
      where.push(`d.customer_id = $${params.length}`);
    } else if (access.mode === 'doctor') {
      params.push(access.doctorId);
      where.push(`EXISTS (SELECT 1 FROM appointments ap WHERE ap.pet_id = d.pet_id AND ap.doctor_id = $${params.length})`);
    } else if (access.mode === 'oversight') {
      if (customer_id) {
        params.push(customer_id);
        where.push(`d.customer_id = $${params.length}`);
      }
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (category) {
      params.push(category);
      where.push(`d.category = $${params.length}`);
    }
    if (pet_id) {
      params.push(pet_id);
      where.push(`d.pet_id = $${params.length}`);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT d.*, p.name AS pet_name, cu.name AS customer_name, up.name AS uploaded_by_name
       FROM documents d
       LEFT JOIN pets p ON d.pet_id = p.id
       LEFT JOIN customers c ON d.customer_id = c.id
       LEFT JOIN users cu ON c.user_id = cu.id
       LEFT JOIN users up ON d.uploaded_by = up.id
       ${whereClause} ORDER BY d.created_at DESC, d.id DESC`,
      params
    );
    res.json({ success: true, data: result.rows.map(toDto) });
  } catch (err) {
    console.error('listDocuments error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/documents  (multipart: file, category, title, pet_id?, notes?)
//
// A customer uploads to their own account. A doctor uploads a prescription for one of their own patients — the
// server always resolves that pet's owner and forces category to PRESCRIPTION; a doctor's client-supplied
// category/customer_id is never trusted, mirroring how a doctor's medical records are always attributed to them.
exports.createDocument = async (req, res) => {
  const file = req.file;
  const fail = async (status, message) => {
    if (file) await removeFile(file.filename);
    return res.status(status).json({ success: false, message });
  };
  try {
    const { isCustomer, customerId: ownCustomerId } = await getCustomerScope(req.user.id);
    let customerId;
    let petId = null;
    let category;

    if (isCustomer) {
      if (!ownCustomerId) return fail(403, 'Documents are available to customer accounts only');
      customerId = ownCustomerId;
      category = req.body.category;
      if (req.body.pet_id) {
        const pet = await db.query('SELECT id FROM pets WHERE id = $1 AND customer_id = $2', [req.body.pet_id, customerId]);
        if (!pet.rows.length) return fail(400, 'Selected pet does not belong to your account');
        petId = pet.rows[0].id;
      }
    } else {
      const scope = await getStaffScope(req.user.id);
      if (!scope.isDoctor) return fail(403, 'You are not allowed to upload documents');
      if (!isPositiveInt(req.body.pet_id)) return fail(400, 'A patient (pet) is required');
      const pet = await db.query('SELECT id, customer_id FROM pets WHERE id = $1', [req.body.pet_id]);
      if (!pet.rows.length) return fail(400, 'Pet not found');
      const assigned = await db.query('SELECT 1 FROM appointments WHERE pet_id = $1 AND doctor_id = $2 LIMIT 1', [pet.rows[0].id, scope.doctorId]);
      if (!assigned.rows.length) return fail(403, 'This pet has no appointment assigned to you');
      petId = pet.rows[0].id;
      customerId = pet.rows[0].customer_id;
      category = 'PRESCRIPTION';
    }

    if (!file) return fail(400, 'A file is required');
    const notes = req.body.notes;
    const title = String(req.body.title ?? (isCustomer ? '' : 'Prescription')).trim();
    if (!CATEGORIES.includes(category)) return fail(400, 'Invalid category');
    if (title.length < 2 || title.length > 120) return fail(400, 'Title must be 2–120 characters');
    if (notes && String(notes).length > 500) return fail(400, 'Notes must be at most 500 characters');

    const result = await db.query(
      `INSERT INTO documents (customer_id, pet_id, category, title, notes, original_name, stored_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [customerId, petId, category, title, notes || null, file.originalname, file.filename, file.mimetype, file.size, req.user.id]
    );
    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, isCustomer ? 'DOCUMENT_UPLOADED' : 'PRESCRIPTION_UPLOADED', 'DOCUMENTS', result.rows[0].id, JSON.stringify({ category, pet_id: petId, customer_id: customerId }), req.ip]
    );
    res.status(201).json({ success: true, data: toDto(result.rows[0]), message: isCustomer ? 'Document uploaded' : 'Prescription sent to the patient and operational head' });
  } catch (err) {
    console.error('createDocument error:', err);
    if (file) await removeFile(file.filename);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// A document this caller is allowed to open: their own (customer), their own patient's (doctor), or any
// (admin/operational head) — same rule as resolveAccess, applied to one row instead of a list.
const viewableDocument = async (req, res) => {
  const access = await resolveAccess(req);
  const result = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  const doc = result.rows[0];
  const notFound = () => { res.status(404).json({ success: false, message: 'Document not found' }); return null; };
  if (!doc) return notFound();
  if (access.mode === 'customer') return doc.customer_id === access.customerId ? doc : notFound();
  if (access.mode === 'doctor') {
    const assigned = await db.query('SELECT 1 FROM appointments WHERE pet_id = $1 AND doctor_id = $2 LIMIT 1', [doc.pet_id, access.doctorId]);
    return assigned.rows.length ? doc : notFound();
  }
  if (access.mode === 'oversight') return doc;
  res.status(403).json({ success: false, message: 'Forbidden' });
  return null;
};

// GET /api/documents/:id/link -> short-lived path the app can open without an Authorization header
exports.getDocumentLink = async (req, res) => {
  try {
    const doc = await viewableDocument(req, res);
    if (!doc) return;
    const token = jwt.sign({ doc: doc.id, uid: req.user.id, purpose: 'document' }, secret(), { expiresIn: LINK_TTL });
    res.json({ success: true, data: { path: `/api/documents/${doc.id}/file?token=${token}`, expires_in: 300 } });
  } catch (err) {
    console.error('getDocumentLink error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/documents/:id/file?token=   (no Authorization header; the signed token is the credential)
exports.streamDocument = async (req, res) => {
  try {
    let payload;
    try {
      payload = jwt.verify(String(req.query.token || ''), secret());
    } catch {
      return res.status(401).json({ success: false, message: 'Link expired or invalid' });
    }
    if (payload.purpose !== 'document' || String(payload.doc) !== String(req.params.id)) {
      return res.status(401).json({ success: false, message: 'Link expired or invalid' });
    }
    const viewerRes = await db.query('SELECT id, status FROM users WHERE id = $1', [payload.uid]);
    if (!viewerRes.rows.length || viewerRes.rows[0].status !== 'ACTIVE') return res.status(404).json({ success: false, message: 'Document not found' });

    const docRes = await db.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    const doc = docRes.rows[0];
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

    // Re-derive the signed-link holder's access the same way getDocumentLink authorized it originally.
    const { isCustomer, customerId } = await getCustomerScope(payload.uid);
    if (isCustomer) {
      if (doc.customer_id !== customerId) return res.status(404).json({ success: false, message: 'Document not found' });
    } else {
      const scope = await getStaffScope(payload.uid);
      if (scope.isDoctor) {
        const assigned = await db.query('SELECT 1 FROM appointments WHERE pet_id = $1 AND doctor_id = $2 LIMIT 1', [doc.pet_id, scope.doctorId]);
        if (!assigned.rows.length) return res.status(404).json({ success: false, message: 'Document not found' });
      } else if (!OVERSIGHT_ROLES.includes(scope.role)) {
        return res.status(404).json({ success: false, message: 'Document not found' });
      }
    }
    const filePath = path.join(UPLOAD_ROOT, doc.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'File is no longer available' });

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.original_name || 'document')}`);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // helmet default would block <img> loads from the app
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.sendFile(filePath);
  } catch (err) {
    console.error('streamDocument error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// DELETE /api/documents/:id — the customer who owns it, the staff member who uploaded it, or an admin.
exports.deleteDocument = async (req, res) => {
  try {
    const doc = await viewableDocument(req, res);
    if (!doc) return;
    const { isCustomer } = await getCustomerScope(req.user.id);
    const scope = isCustomer ? null : await getStaffScope(req.user.id);
    const allowed = isCustomer || doc.uploaded_by === req.user.id || scope?.role === 'ADMIN';
    if (!allowed) return res.status(403).json({ success: false, message: 'You can only delete a document you uploaded' });
    await db.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    await removeFile(doc.stored_name);
    res.json({ success: true, message: 'Document deleted' });
  } catch (err) {
    console.error('deleteDocument error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
