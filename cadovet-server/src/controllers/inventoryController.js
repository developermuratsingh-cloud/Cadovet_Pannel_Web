const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../database');
const { getStaffScope } = require('../utils/staffScope');

// A photo of a physical medicine slip, attached to a dispense-to-doctor entry. Public (served from app.js), same
// treatment as a service photo — an internal operational record, not customer data, so no signed-link machinery.
const SLIP_UPLOAD_ROOT = path.resolve(__dirname, '../../uploads/inventory-slips');
const MAX_SLIP_BYTES = 5 * 1024 * 1024;
const SLIP_EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const slipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(SLIP_UPLOAD_ROOT, { recursive: true });
    cb(null, SLIP_UPLOAD_ROOT);
  },
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + (SLIP_EXTENSIONS[file.mimetype] || '')),
});
const slipUpload = multer({
  storage: slipStorage,
  limits: { fileSize: MAX_SLIP_BYTES, files: 1 },
  fileFilter: (req, file, cb) => (SLIP_EXTENSIONS[file.mimetype] ? cb(null, true) : cb(new Error('UNSUPPORTED_TYPE'))),
});

exports.uploadSlipImageMiddleware = (req, res, next) => {
  slipUpload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Image is too large (max 5 MB)' });
    if (err.message === 'UNSUPPORTED_TYPE') return res.status(400).json({ success: false, message: 'Only JPG, PNG, WEBP or GIF images are allowed' });
    return res.status(400).json({ success: false, message: 'Could not read the uploaded image' });
  });
};

// POST /api/inventory/upload-slip-image  (multipart, field "image") — returns the URL to pass as slip_image_url.
exports.uploadSlipImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image file received' });
  const url = `${req.protocol}://${req.get('host')}/uploads/inventory-slips/${req.file.filename}`;
  res.status(201).json({ success: true, data: { url }, message: 'Slip image uploaded successfully' });
};

// Helper to determine status from quantity
function getStatus(qty, minAlert) {
  if (qty <= 0) return 'OUT_OF_STOCK';
  if (qty <= minAlert) return 'LOW_STOCK';
  return 'IN_STOCK';
}

// The two desk roles: each is locked to its own department (PHARMACY -> MEDICINE, INVENTORY -> INVENTORY) —
// enforced at creation (userController) so scope.departmentName is always right for them.
const DESK_ROLES = ['PHARMACY', 'INVENTORY'];

// A "desk" is (department, branch): PHARMACY/INVENTORY belong to one department and only ever see/manage that
// department's stock — locked, same as before. Every non-ADMIN role is additionally locked to whichever branch
// they're CURRENTLY working out of (`activeLocationId`, switched from the UI) — a pharmacist logged in at Branch A
// never sees or touches Branch B's shelf, even though they may also be rostered there. ADMIN alone is never
// branch-locked, and can filter by department/location explicitly via query params to audit any desk anywhere.
const resolveDeskScope = async (req) => {
  const scope = await getStaffScope(req.user.id);
  if (scope.role === 'ADMIN') {
    return {
      departmentLocked: false, departmentName: req.query.department || null,
      locationLocked: false, locationId: req.query.location_id ? Number(req.query.location_id) : null,
    };
  }
  const isDesk = DESK_ROLES.includes(scope.role);
  return {
    departmentLocked: isDesk, departmentName: isDesk ? scope.departmentName : (req.query.department || null),
    locationLocked: true, locationId: scope.activeLocationId,
  };
};

// True when this item/transaction is outside the caller's desk — either the wrong department (a locked
// PHARMACY/INVENTORY account) or the wrong branch (everyone except ADMIN). Treated as "not found" rather than
// "forbidden" everywhere it's used, so a Pharmacy desk at Branch A can't even confirm Branch B's item exists.
const outsideDesk = (deptScope, row) => {
  if (deptScope.departmentName && row.department_name !== deptScope.departmentName) return true;
  if (deptScope.locationLocked) {
    if (!deptScope.locationId) return true; // no active branch selected yet -> sees nothing, never "every branch"
    return row.location_id !== deptScope.locationId;
  }
  return false;
};

// GET /api/inventory
exports.listInventory = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const deptScope = await resolveDeskScope(req);

    // The stat cards (Total / Low Stock / Out of Stock) stay in sync with department + branch + category + search,
    // but deliberately ignore the status filter — otherwise switching to "Low Stock" also shrinks "Total SKUs" to
    // the low-stock count, and there's no number left on screen that means "everything" to tap back to.
    let metricsWhere = [];
    let metricsParams = [];
    let midx = 1;

    if (deptScope.departmentName) {
      metricsWhere.push(`d.name = $${midx++}`);
      metricsParams.push(deptScope.departmentName);
    }
    if (deptScope.locationLocked) {
      // No active branch selected yet -> see nothing, never every branch's stock (fail closed, same as a
      // doctor account with no linked doctor profile matching doctor_id -1).
      metricsWhere.push(deptScope.locationId ? `i.location_id = $${midx++}` : '1 = 0');
      if (deptScope.locationId) metricsParams.push(deptScope.locationId);
    } else if (deptScope.locationId) {
      metricsWhere.push(`i.location_id = $${midx++}`);
      metricsParams.push(deptScope.locationId);
    }
    if (category && category !== 'ALL') {
      metricsWhere.push(`i.category = $${midx++}`);
      metricsParams.push(category);
    }
    if (search) {
      metricsWhere.push(`(i.name ILIKE $${midx} OR i.sku ILIKE $${midx} OR i.supplier ILIKE $${midx})`);
      metricsParams.push(`%${search}%`);
      midx++;
    }
    const metricsWhereClause = metricsWhere.length ? 'WHERE ' + metricsWhere.join(' AND ') : '';

    const metricsRes = await db.query(`
      SELECT
        COUNT(*) as total_items,
        COUNT(CASE WHEN i.status = 'LOW_STOCK' THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN i.status = 'OUT_OF_STOCK' THEN 1 END) as out_of_stock_items,
        COALESCE(SUM(i.stock_quantity * i.unit_price), 0) as total_stock_value
      FROM inventory i
      LEFT JOIN departments d ON d.id = i.department_id
      ${metricsWhereClause}
    `, metricsParams);
    const metrics = metricsRes.rows[0] || {};

    // The table itself still respects every filter, including status.
    let where = [...metricsWhere];
    let params = [...metricsParams];
    let idx = midx;
    if (status && status !== 'ALL') {
      where.push(`i.status = $${idx++}`);
      params.push(status);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const dataQuery = `
      SELECT i.*, d.name AS department_name, l.name AS location_name
      FROM inventory i
      LEFT JOIN departments d ON d.id = i.department_id
      LEFT JOIN locations l ON l.id = i.location_id
      ${whereClause}
      ORDER BY
        CASE
          WHEN i.status = 'OUT_OF_STOCK' THEN 1
          WHEN i.status = 'LOW_STOCK' THEN 2
          ELSE 3
        END,
        i.name ASC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const dataParams = [...params, limit, offset];
    const result = await db.query(dataQuery, dataParams);

    // Separate from the metrics above: this is the count of rows matching every filter (status included), for
    // pagination — not the same number as "Total SKUs" once a status filter is active.
    const countRes = await db.query(`SELECT COUNT(*) FROM inventory i LEFT JOIN departments d ON d.id = i.department_id ${whereClause}`, params);
    const filteredTotal = parseInt(countRes.rows[0]?.count || 0, 10);

    res.json({
      success: true,
      data: result.rows,
      metrics: {
        totalItems: parseInt(metrics.total_items || 0, 10),
        lowStockItems: parseInt(metrics.low_stock_items || 0, 10),
        outOfStockItems: parseInt(metrics.out_of_stock_items || 0, 10),
        totalStockValue: parseFloat(metrics.total_stock_value || 0)
      },
      pagination: {
        total: filteredTotal,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(filteredTotal / limit)
      }
    });
  } catch (error) {
    console.error('listInventory error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory', error: error.message });
  }
};

// GET /api/inventory/:id
exports.getInventoryItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const deptScope = await resolveDeskScope(req);
    const result = await db.query(
      `SELECT i.*, d.name AS department_name, l.name AS location_name FROM inventory i
       LEFT JOIN departments d ON d.id = i.department_id LEFT JOIN locations l ON l.id = i.location_id WHERE i.id = $1`,
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    if (outsideDesk(deptScope, result.rows[0])) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getInventoryItemById error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve item', error: error.message });
  }
};

// POST /api/inventory
exports.createInventoryItem = async (req, res) => {
  try {
    const {
      name,
      category,
      sku,
      stock_quantity = 0,
      min_alert_quantity = 10,
      unit_price = 0,
      expiry_date,
      supplier
    } = req.body;

    if (!name || !category || !sku) {
      return res.status(400).json({ success: false, message: 'Name, Category, and SKU are required' });
    }

    // A desk can only stock its own department, at its own branch; ADMIN must say which desk (and which branch)
    // this belongs to.
    const deptScope = await resolveDeskScope(req);
    const departmentName = deptScope.departmentLocked ? deptScope.departmentName : req.body.department;
    if (!departmentName) return res.status(400).json({ success: false, message: 'Select Pharmacy or Inventory for this item' });
    const deptRow = await db.query('SELECT id FROM departments WHERE name = $1', [departmentName]);
    if (!deptRow.rows.length) return res.status(400).json({ success: false, message: 'Unknown department' });

    const locationId = deptScope.locationLocked ? deptScope.locationId : Number(req.body.location_id);
    if (!locationId) return res.status(400).json({ success: false, message: deptScope.locationLocked ? 'Choose a branch to work from first (top bar)' : 'Select a branch for this item' });
    const locRow = await db.query("SELECT id FROM locations WHERE id = $1 AND status = 'ACTIVE'", [locationId]);
    if (!locRow.rows.length) return res.status(400).json({ success: false, message: 'Unknown or inactive branch' });

    const qty = parseInt(stock_quantity, 10) || 0;
    const minAlert = parseInt(min_alert_quantity, 10) || 10;
    const status = getStatus(qty, minAlert);

    const result = await db.query(`
      INSERT INTO inventory (
        name, category, sku, stock_quantity, min_alert_quantity, unit_price, expiry_date, supplier, status, department_id, location_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [name, category, sku, qty, minAlert, parseFloat(unit_price) || 0, expiry_date || null, supplier || null, status, deptRow.rows[0].id, locationId]);

    res.status(201).json({
      success: true,
      message: 'Inventory item added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'An item with this SKU already exists' });
    }
    console.error('createInventoryItem error:', error);
    res.status(500).json({ success: false, message: 'Failed to create inventory item', error: error.message });
  }
};

// PUT /api/inventory/:id
exports.updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      sku,
      stock_quantity,
      min_alert_quantity,
      unit_price,
      expiry_date,
      supplier
    } = req.body;

    const deptScope = await resolveDeskScope(req);
    const existing = await db.query(
      `SELECT i.*, d.name AS department_name FROM inventory i LEFT JOIN departments d ON d.id = i.department_id WHERE i.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const current = existing.rows[0];
    if (outsideDesk(deptScope, current)) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const qty = stock_quantity !== undefined ? parseInt(stock_quantity, 10) : current.stock_quantity;
    const minAlert = min_alert_quantity !== undefined ? parseInt(min_alert_quantity, 10) : current.min_alert_quantity;
    const status = getStatus(qty, minAlert);

    const result = await db.query(`
      UPDATE inventory
      SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        sku = COALESCE($3, sku),
        stock_quantity = $4,
        min_alert_quantity = $5,
        unit_price = COALESCE($6, unit_price),
        expiry_date = COALESCE($7, expiry_date),
        supplier = COALESCE($8, supplier),
        status = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [name, category, sku, qty, minAlert, unit_price !== undefined ? parseFloat(unit_price) : null, expiry_date, supplier, status, id]);

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('updateInventoryItem error:', error);
    res.status(500).json({ success: false, message: 'Failed to update item', error: error.message });
  }
};

// PATCH /api/inventory/:id/adjust-stock
exports.adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body; // e.g., +10 or -5

    if (delta === undefined || isNaN(delta)) {
      return res.status(400).json({ success: false, message: 'delta integer is required' });
    }

    const deptScope = await resolveDeskScope(req);
    const existing = await db.query(
      `SELECT i.*, d.name AS department_name FROM inventory i LEFT JOIN departments d ON d.id = i.department_id WHERE i.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    const current = existing.rows[0];
    if (outsideDesk(deptScope, current)) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const newQty = Math.max(0, current.stock_quantity + parseInt(delta, 10));
    const newStatus = getStatus(newQty, current.min_alert_quantity);

    const result = await db.query(`
      UPDATE inventory
      SET
        stock_quantity = $1,
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [newQty, newStatus, id]);

    res.json({
      success: true,
      message: `Stock adjusted by ${delta > 0 ? '+' + delta : delta}`,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('adjustStock error:', error);
    res.status(500).json({ success: false, message: 'Failed to adjust stock', error: error.message });
  }
};

// DELETE /api/inventory/:id
exports.deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deptScope = await resolveDeskScope(req);
    const existing = await db.query(
      `SELECT i.*, d.name AS department_name FROM inventory i LEFT JOIN departments d ON d.id = i.department_id WHERE i.id = $1`,
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    if (outsideDesk(deptScope, existing.rows[0])) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    await db.query('DELETE FROM inventory WHERE id = $1', [id]);
    res.json({ success: true, message: 'Item removed from inventory' });
  } catch (error) {
    console.error('deleteInventoryItem error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete item', error: error.message });
  }
};

// POST /api/inventory/:id/dispense  { doctor_id, quantity, notes }  (pharmacy/inventory desk, or ops/admin)
// Hands stock from the desk to a doctor's bag — decrements the desk's stock and logs who got what, so the doctor
// can see it under "My Stock" and the desk/ops/admin can see it in the dispense log.
exports.dispenseToDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_id, quantity, notes, slip_image_url } = req.body;
    const qty = parseInt(quantity, 10);
    if (!doctor_id || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'doctor_id and a positive quantity are required' });
    }
    if (slip_image_url !== undefined && slip_image_url !== null && typeof slip_image_url !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid slip image' });
    }

    const deptScope = await resolveDeskScope(req);
    const itemRes = await db.query(
      `SELECT i.*, d.name AS department_name FROM inventory i LEFT JOIN departments d ON d.id = i.department_id WHERE i.id = $1`,
      [id]
    );
    if (!itemRes.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    const item = itemRes.rows[0];
    if (outsideDesk(deptScope, item)) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    if (qty > item.stock_quantity) return res.status(400).json({ success: false, message: 'Not enough stock to dispense that quantity' });

    // The doctor must actually be rostered at this item's branch — a Pharmacy desk shouldn't be able to hand stock
    // to a doctor who's never worked there.
    const doctorRes = await db.query(
      `SELECT doc.id FROM doctors doc
       JOIN user_locations ul ON ul.user_id = doc.user_id AND ul.location_id = $2
       WHERE doc.id = $1 AND doc.status = 'ACTIVE'`,
      [doctor_id, item.location_id]
    );
    if (!doctorRes.rows.length) return res.status(400).json({ success: false, message: 'That doctor is not rostered at this branch' });

    const newQty = item.stock_quantity - qty;
    const newStatus = getStatus(newQty, item.min_alert_quantity);
    await db.query('UPDATE inventory SET stock_quantity = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [newQty, newStatus, id]);

    const txn = await db.query(
      `INSERT INTO inventory_transactions (inventory_id, type, quantity, department_id, location_id, doctor_id, performed_by, notes, slip_image_url)
       VALUES ($1, 'DISPENSE_TO_DOCTOR', $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, qty, item.department_id, item.location_id, doctor_id, req.user.id, notes || null, slip_image_url || null]
    );

    res.status(201).json({ success: true, message: 'Dispensed to doctor', data: txn.rows[0] });
  } catch (error) {
    console.error('dispenseToDoctor error:', error);
    res.status(500).json({ success: false, message: 'Failed to dispense item', error: error.message });
  }
};

// POST /api/inventory/:id/use  { pet_id, appointment_id?, quantity, notes }  (doctor only)
// A doctor recording medicine/supplies they used on a visit — decrements the desk's overall stock and logs the
// doctor, the patient, and (when given) the appointment it was used for.
exports.useOnPatient = async (req, res) => {
  try {
    const scope = await getStaffScope(req.user.id);
    if (!scope.isDoctor) return res.status(403).json({ success: false, message: 'Only a doctor can log medicine used on a patient' });

    const { id } = req.params;
    const { pet_id, appointment_id, quantity, notes } = req.body;
    const qty = parseInt(quantity, 10);
    if (!pet_id || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'pet_id and a positive quantity are required' });
    }

    const petRes = await db.query('SELECT id FROM pets WHERE id = $1', [pet_id]);
    if (!petRes.rows.length) return res.status(400).json({ success: false, message: 'Pet not found' });

    if (appointment_id) {
      const apptRes = await db.query('SELECT id FROM appointments WHERE id = $1 AND doctor_id = $2', [appointment_id, scope.doctorId]);
      if (!apptRes.rows.length) return res.status(400).json({ success: false, message: 'That appointment is not assigned to you' });
    }

    const itemRes = await db.query('SELECT * FROM inventory WHERE id = $1', [id]);
    if (!itemRes.rows.length) return res.status(404).json({ success: false, message: 'Item not found' });
    const item = itemRes.rows[0];
    if (qty > item.stock_quantity) return res.status(400).json({ success: false, message: 'Not enough stock recorded for that quantity' });

    const newQty = item.stock_quantity - qty;
    const newStatus = getStatus(newQty, item.min_alert_quantity);
    await db.query('UPDATE inventory SET stock_quantity = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [newQty, newStatus, id]);

    const txn = await db.query(
      `INSERT INTO inventory_transactions (inventory_id, type, quantity, department_id, location_id, doctor_id, pet_id, appointment_id, performed_by, notes)
       VALUES ($1, 'USED_ON_PATIENT', $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [id, qty, item.department_id, item.location_id, scope.doctorId, pet_id, appointment_id || null, req.user.id, notes || null]
    );

    res.status(201).json({ success: true, message: 'Usage recorded', data: txn.rows[0] });
  } catch (error) {
    console.error('useOnPatient error:', error);
    res.status(500).json({ success: false, message: 'Failed to record usage', error: error.message });
  }
};

// GET /api/inventory/transactions?type=&department=&location_id=
// A doctor sees only their own (what was dispensed to them, and what they've used, across every branch they work
// at — their bag isn't location-scoped). Everyone else is scoped to their own currently-active branch (ADMIN
// alone can see/filter across every branch); a desk (PHARMACY/INVENTORY) is additionally scoped to its own department.
exports.listTransactions = async (req, res) => {
  try {
    const scope = await getStaffScope(req.user.id);
    if (!scope.isDoctor && !['ADMIN', 'OPERATIONAL_HEAD', ...DESK_ROLES].includes(scope.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { type } = req.query;
    const where = [];
    const params = [];
    let idx = 1;

    if (scope.isDoctor) {
      where.push(`t.doctor_id = $${idx++}`);
      params.push(scope.doctorId);
    } else {
      const deptFilter = DESK_ROLES.includes(scope.role) ? scope.departmentName : req.query.department;
      if (deptFilter) {
        where.push(`d.name = $${idx++}`);
        params.push(deptFilter);
      }
      if (scope.role === 'ADMIN') {
        if (req.query.location_id) {
          where.push(`t.location_id = $${idx++}`);
          params.push(req.query.location_id);
        }
      } else if (scope.activeLocationId) {
        where.push(`t.location_id = $${idx++}`);
        params.push(scope.activeLocationId);
      } else {
        where.push('1 = 0'); // no active branch selected yet
      }
    }

    // ADMIN/OPERATIONAL_HEAD (and a desk, within its own department+branch) auditing one doctor's issued-items history.
    if (!scope.isDoctor && req.query.doctor_id) {
      where.push(`t.doctor_id = $${idx++}`);
      params.push(req.query.doctor_id);
    }

    if (type) {
      where.push(`t.type = $${idx++}`);
      params.push(type);
    }

    // Date range on the issued-items history (e.g. "last 30 days"). Both ends are optional and inclusive;
    // date_to is treated as end-of-day so that day's own entries aren't excluded.
    if (req.query.date_from) {
      where.push(`t.created_at >= $${idx++}::date`);
      params.push(req.query.date_from);
    }
    if (req.query.date_to) {
      where.push(`t.created_at < ($${idx++}::date + INTERVAL '1 day')`);
      params.push(req.query.date_to);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const result = await db.query(`
      SELECT t.*, i.name AS item_name, i.sku, i.category, d.name AS department_name,
             du.name AS doctor_name, p.name AS pet_name, pu.name AS performed_by_name,
             disp.id AS dispute_id, disp.status AS dispute_status
      FROM inventory_transactions t
      JOIN inventory i ON i.id = t.inventory_id
      LEFT JOIN departments d ON d.id = t.department_id
      LEFT JOIN doctors doc ON doc.id = t.doctor_id
      LEFT JOIN users du ON du.id = doc.user_id
      LEFT JOIN pets p ON p.id = t.pet_id
      LEFT JOIN users pu ON pu.id = t.performed_by
      LEFT JOIN LATERAL (
        SELECT id, status FROM inventory_disputes WHERE transaction_id = t.id ORDER BY created_at DESC LIMIT 1
      ) disp ON true
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT 200
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('listTransactions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load transactions', error: error.message });
  }
};

// POST /api/inventory/transactions/:id/dispute  { message }  (doctor only, on their own transaction)
// "This doesn't look right" — flags a specific dispense/usage entry. Immediately visible to admin, the
// operational head, and the desk that issued the item — whichever of them gets to it first can resolve it.
exports.raiseDispute = async (req, res) => {
  try {
    const scope = await getStaffScope(req.user.id);
    if (!scope.isDoctor) return res.status(403).json({ success: false, message: 'Only a doctor can report an issue' });

    const { id } = req.params;
    const message = String(req.body.message || '').trim();
    if (!message) return res.status(400).json({ success: false, message: 'Describe what looks wrong' });
    if (message.length > 500) return res.status(400).json({ success: false, message: 'Message must be at most 500 characters' });

    const txnRes = await db.query('SELECT * FROM inventory_transactions WHERE id = $1 AND doctor_id = $2', [id, scope.doctorId]);
    if (!txnRes.rows.length) return res.status(404).json({ success: false, message: 'Transaction not found' });
    const txn = txnRes.rows[0];

    const openRes = await db.query(
      "SELECT id FROM inventory_disputes WHERE transaction_id = $1 AND status != 'RESOLVED'",
      [id]
    );
    if (openRes.rows.length) return res.status(400).json({ success: false, message: 'This entry already has an open report' });

    const result = await db.query(
      `INSERT INTO inventory_disputes (transaction_id, doctor_id, department_id, location_id, message)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, scope.doctorId, txn.department_id, txn.location_id, message]
    );

    res.status(201).json({ success: true, message: 'Sent to admin, the operational head, and the department for review', data: result.rows[0] });
  } catch (error) {
    console.error('raiseDispute error:', error);
    res.status(500).json({ success: false, message: 'Failed to send report', error: error.message });
  }
};

// GET /api/inventory/disputes?status=
// DOCTOR: their own reports and their outcome. ADMIN/OPERATIONAL_HEAD: everything. PHARMACY/INVENTORY (a desk):
// every report against their own department, from the moment it's raised — not gated behind an ops hand-off — so
// admin, the operational head, and the desk all see a new report at the same time and any one of them can act on it.
exports.listDisputes = async (req, res) => {
  try {
    const scope = await getStaffScope(req.user.id);
    if (!scope.isDoctor && !['ADMIN', 'OPERATIONAL_HEAD', ...DESK_ROLES].includes(scope.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const where = [];
    const params = [];
    let idx = 1;

    if (scope.isDoctor) {
      where.push(`disp.doctor_id = $${idx++}`);
      params.push(scope.doctorId);
    } else {
      if (DESK_ROLES.includes(scope.role)) {
        where.push(`d.name = $${idx++}`);
        params.push(scope.departmentName);
      }
      if (scope.role === 'ADMIN') {
        if (req.query.location_id) {
          where.push(`disp.location_id = $${idx++}`);
          params.push(req.query.location_id);
        }
      } else if (scope.activeLocationId) {
        where.push(`disp.location_id = $${idx++}`);
        params.push(scope.activeLocationId);
      } else {
        where.push('1 = 0');
      }
    }

    if (req.query.status) {
      where.push(`disp.status = $${idx++}`);
      params.push(req.query.status);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const result = await db.query(`
      SELECT disp.*, t.quantity, t.type AS transaction_type, t.created_at AS transaction_date,
             i.name AS item_name, i.sku, d.name AS department_name,
             du.name AS doctor_name, ru.name AS ops_reviewed_by_name, fu.name AS resolved_by_name
      FROM inventory_disputes disp
      JOIN inventory_transactions t ON t.id = disp.transaction_id
      JOIN inventory i ON i.id = t.inventory_id
      LEFT JOIN departments d ON d.id = disp.department_id
      LEFT JOIN doctors doc ON doc.id = disp.doctor_id
      LEFT JOIN users du ON du.id = doc.user_id
      LEFT JOIN users ru ON ru.id = disp.ops_reviewed_by
      LEFT JOIN users fu ON fu.id = disp.resolved_by
      ${whereClause}
      ORDER BY disp.created_at DESC
      LIMIT 200
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('listDisputes error:', error);
    res.status(500).json({ success: false, message: 'Failed to load reports', error: error.message });
  }
};

// PATCH /api/inventory/disputes/:id/forward  { note? }  (OPERATIONAL_HEAD/ADMIN)
// Verifies the report is worth acting on and sends it to the desk that issued the item.
exports.forwardDispute = async (req, res) => {
  try {
    const scope = await getStaffScope(req.user.id);
    if (!['ADMIN', 'OPERATIONAL_HEAD'].includes(scope.role)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { id } = req.params;
    const existing = await db.query("SELECT * FROM inventory_disputes WHERE id = $1 AND status = 'PENDING_REVIEW'", [id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Report not found or already handled' });
    if (scope.role === 'OPERATIONAL_HEAD' && existing.rows[0].location_id !== scope.activeLocationId) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const result = await db.query(
      `UPDATE inventory_disputes SET status = 'FORWARDED', ops_reviewed_by = $1, ops_reviewed_at = CURRENT_TIMESTAMP, ops_note = $2 WHERE id = $3 RETURNING *`,
      [req.user.id, req.body.note || null, id]
    );
    res.json({ success: true, message: 'Forwarded to the department', data: result.rows[0] });
  } catch (error) {
    console.error('forwardDispute error:', error);
    res.status(500).json({ success: false, message: 'Failed to forward report', error: error.message });
  }
};

// PATCH /api/inventory/disputes/:id/dismiss  { note? }  (OPERATIONAL_HEAD/ADMIN)
// Verified and found nothing to escalate (e.g. a misunderstanding) — closes it without involving the desk.
exports.dismissDispute = async (req, res) => {
  try {
    const scope = await getStaffScope(req.user.id);
    if (!['ADMIN', 'OPERATIONAL_HEAD'].includes(scope.role)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { id } = req.params;
    const existing = await db.query("SELECT * FROM inventory_disputes WHERE id = $1 AND status = 'PENDING_REVIEW'", [id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Report not found or already handled' });
    if (scope.role === 'OPERATIONAL_HEAD' && existing.rows[0].location_id !== scope.activeLocationId) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const result = await db.query(
      `UPDATE inventory_disputes SET status = 'RESOLVED', ops_reviewed_by = $1, ops_reviewed_at = CURRENT_TIMESTAMP,
              ops_note = $2, resolved_by = $1, resolved_at = CURRENT_TIMESTAMP, resolution_note = COALESCE($2, 'Reviewed — no action needed')
       WHERE id = $3 RETURNING *`,
      [req.user.id, req.body.note || null, id]
    );
    res.json({ success: true, message: 'Marked resolved', data: result.rows[0] });
  } catch (error) {
    console.error('dismissDispute error:', error);
    res.status(500).json({ success: false, message: 'Failed to dismiss report', error: error.message });
  }
};

// PATCH /api/inventory/disputes/:id/resolve  { note? }  (ADMIN, OPERATIONAL_HEAD, or PHARMACY/INVENTORY in its own department)
// Resolvable straight from PENDING_REVIEW or from FORWARDED — whichever of the three panels gets to it first can
// close it out; forwarding is an optional hand-off note, never a required gate before this.
exports.resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = await getStaffScope(req.user.id);
    const existing = await db.query(
      `SELECT disp.*, d.name AS department_name FROM inventory_disputes disp LEFT JOIN departments d ON d.id = disp.department_id WHERE disp.id = $1 AND disp.status != 'RESOLVED'`,
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Report not found or already resolved' });
    if (DESK_ROLES.includes(scope.role) && existing.rows[0].department_name !== scope.departmentName) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    if (scope.role !== 'ADMIN' && existing.rows[0].location_id !== scope.activeLocationId) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const result = await db.query(
      `UPDATE inventory_disputes SET status = 'RESOLVED', resolved_by = $1, resolved_at = CURRENT_TIMESTAMP, resolution_note = $2 WHERE id = $3 RETURNING *`,
      [req.user.id, req.body.note || null, id]
    );
    res.json({ success: true, message: 'Marked resolved', data: result.rows[0] });
  } catch (error) {
    console.error('resolveDispute error:', error);
    res.status(500).json({ success: false, message: 'Failed to resolve report', error: error.message });
  }
};
