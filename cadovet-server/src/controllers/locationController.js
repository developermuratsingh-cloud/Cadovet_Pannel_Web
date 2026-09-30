const db = require('../database');
const { getStaffScope } = require('../utils/staffScope');

// GET /api/locations/public  — unauthenticated: which branches the website's booking form can offer a visitor.
exports.listPublicLocations = async (req, res) => {
  try {
    const result = await db.query(`SELECT id, name, address, city, phone FROM locations WHERE status = 'ACTIVE' ORDER BY name`);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listPublicLocations error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/locations  (any signed-in staff — needed for the branch switcher and assignment dropdowns, not just admin)
// ?mine=true restricts to the caller's own roster, for the "which branch am I working from" switcher.
exports.listLocations = async (req, res) => {
  try {
    if (req.query.mine === 'true') {
      const scope = await getStaffScope(req.user.id);
      return res.json({ success: true, data: scope.locations, active_location_id: scope.activeLocationId });
    }
    const result = await db.query(
      `SELECT l.*, COUNT(ul.user_id)::int AS staff_count
       FROM locations l LEFT JOIN user_locations ul ON ul.location_id = l.id
       GROUP BY l.id ORDER BY l.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listLocations error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/locations/:id/staff  (LOCATION_MANAGE) — who's rostered here, for the branch detail view.
exports.listLocationStaff = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, r.name AS role_name, dept.name AS department_name, (u.active_location_id = $1) AS is_active_here
       FROM user_locations ul
       JOIN users u ON u.id = ul.user_id
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN departments dept ON dept.id = u.department_id
       WHERE ul.location_id = $1
       ORDER BY r.name, u.name`,
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listLocationStaff error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/locations  (LOCATION_MANAGE)
exports.createLocation = async (req, res) => {
  try {
    const { name, address, city, phone } = req.body;
    if (!name || String(name).trim().length < 2 || String(name).length > 100) {
      return res.status(400).json({ success: false, message: 'Branch name must be 2-100 characters' });
    }
    const result = await db.query(
      'INSERT INTO locations (name, address, city, phone) VALUES ($1,$2,$3,$4) RETURNING *',
      [String(name).trim(), address || null, city || null, phone || null]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'Branch added' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'A branch with this name already exists' });
    console.error('createLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PUT /api/locations/:id  (LOCATION_MANAGE)
exports.updateLocation = async (req, res) => {
  try {
    const { name, address, city, phone } = req.body;
    const existing = await db.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Branch not found' });
    const result = await db.query(
      `UPDATE locations SET name = COALESCE($1, name), address = $2, city = $3, phone = $4 WHERE id = $5 RETURNING *`,
      [name ? String(name).trim() : null, address ?? existing.rows[0].address, city ?? existing.rows[0].city, phone ?? existing.rows[0].phone, req.params.id]
    );
    res.json({ success: true, data: result.rows[0], message: 'Branch updated' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'A branch with this name already exists' });
    console.error('updateLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PATCH /api/locations/:id/status  (LOCATION_MANAGE) — deactivate a closed branch without deleting its history.
exports.toggleStatus = async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM locations WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ success: false, message: 'Branch not found' });
    const next = existing.rows[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const result = await db.query('UPDATE locations SET status = $1 WHERE id = $2 RETURNING *', [next, req.params.id]);
    res.json({ success: true, data: result.rows[0], message: `Branch ${next === 'ACTIVE' ? 'activated' : 'deactivated'}` });
  } catch (err) {
    console.error('toggleStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PATCH /api/auth/active-location  { location_id }  (any staff, self-service)
// Switches which of the caller's OWN assigned branches they're currently working out of — the "desk" every other
// scoped endpoint (inventory, appointments, dispenses) reads live off `users.active_location_id`.
exports.setActiveLocation = async (req, res) => {
  try {
    const { location_id } = req.body;
    if (!location_id) return res.status(400).json({ success: false, message: 'Choose a branch' });
    const allowed = await db.query('SELECT 1 FROM user_locations WHERE user_id = $1 AND location_id = $2', [req.user.id, location_id]);
    if (!allowed.rows.length) return res.status(403).json({ success: false, message: "You aren't assigned to that branch" });
    await db.query('UPDATE users SET active_location_id = $1 WHERE id = $2', [location_id, req.user.id]);
    const loc = await db.query('SELECT * FROM locations WHERE id = $1', [location_id]);
    res.json({ success: true, data: loc.rows[0], message: `Now working from ${loc.rows[0].name}` });
  } catch (err) {
    console.error('setActiveLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
