const crypto = require('crypto');
const db = require('../database');
const { canonicalMobile } = require('../utils/mobile');
const { validatePassword } = require('../utils/validation');
const { setUserLocations } = require('../utils/staffScope');

// GET /api/users — list all users with role & department
exports.listUsers = async (req, res) => {
  try {
    const { search, role, department, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = [];
    let params = [];
    let idx = 1;

    if (search) {
      where.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.mobile ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (role) { where.push(`r.name = $${idx++}`); params.push(role); }
    if (department) { where.push(`d.name = $${idx++}`); params.push(department); }
    if (status) { where.push(`u.status = $${idx++}`); params.push(status); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       ${whereClause}`, params
    );

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.mobile, u.identifier_type, u.status,
              r.name as role_name, d.name as department_name, u.created_at
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.mobile, u.identifier_type, u.status,
              r.id as role_id, r.name as role_name, d.id as department_id, d.name as department_name, u.created_at
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    // Get permissions
    const perms = await db.query(
      `SELECT p.name FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1`, [result.rows[0].role_id]
    );
    const locs = await db.query(
      `SELECT l.id, l.name FROM user_locations ul JOIN locations l ON l.id = ul.location_id WHERE ul.user_id = $1 ORDER BY l.name`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...result.rows[0], permissions: perms.rows.map(r => r.name), locations: locs.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/users
const bcrypt = require('bcryptjs');
// A PHARMACY or INVENTORY account's desk is implied by their role — never a manual pick, so it can never be set
// wrong or left blank. Kept in one place since both createUser and updateUser need it.
const ROLE_DEPARTMENT = { PHARMACY: 'MEDICINE', INVENTORY: 'INVENTORY' };

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    let department_id = req.body.department_id;
    const location_ids = Array.isArray(req.body.location_ids) ? req.body.location_ids : [];
    const mobile = req.body.mobile ? canonicalMobile(req.body.mobile) : null;
    if (req.body.mobile && !mobile) return res.status(400).json({ success: false, message: 'Enter a valid mobile number' });

    // Staff sign in with email + password. The administrator sets a temporary password that the person must replace at
    // their first sign-in. (Customers use mobile + OTP and are registered on the Customers page.)
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and a temporary password are required' });
    }
    if (String(name).trim().length < 2 || String(name).length > 100) return res.status(400).json({ success: false, message: 'Name must be 2-100 characters' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(email).length > 255) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    const passwordProblem = validatePassword(password);
    if (passwordProblem) return res.status(400).json({ success: false, message: passwordProblem });

    // Customers are registered on the Customers page and doctors on the Doctors page (a doctor also needs a schedule).
    const role = await db.query('SELECT name FROM roles WHERE id = $1', [role_id]);
    if (!role.rows.length) return res.status(400).json({ success: false, message: 'Choose a role' });
    if (role.rows[0].name === 'CUSTOMER') return res.status(400).json({ success: false, message: 'Register customers from the Customers page' });
    if (role.rows[0].name === 'DOCTOR') return res.status(400).json({ success: false, message: 'Add doctors from the Doctors page' });

    // Pharmacy/Inventory desk staff: the department is the role, not a choice — this is what makes those two
    // sections foolproof (no way to create a Pharmacy account pointed at the wrong stock).
    if (ROLE_DEPARTMENT[role.rows[0].name]) {
      const dept = await db.query('SELECT id FROM departments WHERE name = $1', [ROLE_DEPARTMENT[role.rows[0].name]]);
      department_id = dept.rows[0].id;
    }

    // Every desk/branch worker (Pharmacy, Inventory, Operational Head) needs at least one branch — their own
    // dashboard, inventory scope and appointment queue all key off which location(s) they're rostered at. ADMIN
    // is the one role that's never location-scoped.
    if (['PHARMACY', 'INVENTORY', 'OPERATIONAL_HEAD'].includes(role.rows[0].name) && location_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Assign at least one branch for this staff member' });
    }
    if (location_ids.length) {
      const validLocs = await db.query('SELECT id FROM locations WHERE id = ANY($1) AND status = $2', [location_ids, 'ACTIVE']);
      if (validLocs.rows.length !== new Set(location_ids.map(Number)).size) {
        return res.status(400).json({ success: false, message: 'One or more selected branches are invalid or inactive' });
      }
    }

    const identifier_type = 'EMAIL';
    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, department_id, created_by, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING id, name, email, mobile, identifier_type, status`,
      [name, email || null, mobile || null, password_hash, identifier_type, role_id, department_id || null, req.user.id]
    );

    if (location_ids.length) await setUserLocations(result.rows[0].id, location_ids);

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'USER_CREATED', 'USERS', result.rows[0].id, JSON.stringify(result.rows[0]), req.ip]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'User created successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Email or mobile already in use' });
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { name, role_id, status } = req.body;
    let department_id = req.body.department_id;
    const { id } = req.params;

    const old = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!old.rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    // Moving someone onto (or already on) the Pharmacy/Inventory role always pins their department to match —
    // never left to drift out of sync with the role.
    if (role_id) {
      const role = await db.query('SELECT name FROM roles WHERE id = $1', [role_id]);
      if (ROLE_DEPARTMENT[role.rows[0]?.name]) {
        department_id = (await db.query('SELECT id FROM departments WHERE name = $1', [ROLE_DEPARTMENT[role.rows[0].name]])).rows[0].id;
      }
    }

    const result = await db.query(
      `UPDATE users SET name=$1, role_id=$2, department_id=$3, status=$4, updated_at=NOW()
       WHERE id=$5 RETURNING id, name, email, mobile, status`,
      [name || old.rows[0].name, role_id || old.rows[0].role_id, department_id || old.rows[0].department_id,
       status || old.rows[0].status, id]
    );

    // Replaces the branch roster wholesale when the field is sent at all (including an empty array, to clear it);
    // omitting it entirely leaves the existing roster untouched.
    if (Array.isArray(req.body.location_ids)) await setUserLocations(id, req.body.location_ids);

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [req.user.id, 'USER_UPDATED', 'USERS', id, JSON.stringify(old.rows[0]), JSON.stringify(result.rows[0]), req.ip]
    );

    res.json({ success: true, data: result.rows[0], message: 'User updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PATCH /api/users/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (!user.rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    const newStatus = user.rows[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await db.query('UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2', [newStatus, id]);

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [req.user.id, 'USER_UPDATED', 'USERS', id, JSON.stringify({ status: user.rows[0].status }), JSON.stringify({ status: newStatus }), req.ip]
    );

    res.json({ success: true, message: `User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/users/:id/reset-password  { password }   (administrator)
// Sets a new temporary password for a staff member who is locked out or forgot it; they must change it at next sign-in and
// every session they had is ended.
exports.resetUserPassword = async (req, res) => {
  try {
    const { password } = req.body || {};
    const problem = validatePassword(password);
    if (problem) return res.status(400).json({ success: false, message: problem });
    const target = await db.query('SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [req.params.id]);
    if (!target.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.rows[0].role === 'CUSTOMER') return res.status(400).json({ success: false, message: 'Customers have no password (they sign in with an OTP)' });

    const hash = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password_hash = $1, must_change_password = TRUE, password_changed_at = NOW(), token_version = token_version + 1, updated_at = NOW() WHERE id = $2', [hash, req.params.id]);
    await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [req.params.id]);
    await db.query('INSERT INTO audit_logs (user_id, action, module, record_id, ip_address) VALUES ($1,$2,$3,$4,$5)', [req.user.id, 'PASSWORD_RESET_BY_ADMIN', 'USERS', req.params.id, req.ip]);
    res.json({ success: true, message: 'Password reset. The user must choose a new one at next sign-in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
