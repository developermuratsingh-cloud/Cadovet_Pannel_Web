const crypto = require('crypto');
const db = require('../database');
const { getStaffScope } = require('../utils/staffScope');
const { canonicalMobile } = require('../utils/mobile');
const bcrypt = require('bcryptjs');

// GET /api/customers
exports.listCustomers = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = [`r.name = 'CUSTOMER'`];
    let params = [];
    let idx = 1;

    if (search) {
      where.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx} OR u.mobile ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (status) { where.push(`u.status = $${idx++}`); params.push(status); }
    // A doctor only sees customers whose pet has an appointment assigned to them.
    const scope = await getStaffScope(req.user.id);
    if (scope.isDoctor) {
      where.push(`EXISTS (SELECT 1 FROM appointments ap JOIN customers cc ON cc.id = ap.customer_id WHERE cc.user_id = u.id AND ap.doctor_id = $${idx++})`);
      params.push(scope.doctorId);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*) FROM users u LEFT JOIN roles r ON u.role_id = r.id ${whereClause}`, params
    );

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.mobile, u.status, u.created_at,
              c.id as customer_id, c.city, c.address, c.pincode
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN customers c ON c.user_id = u.id
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
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/customers/:id
exports.getCustomer = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.mobile, u.identifier_type, u.status, u.created_at,
              c.id as customer_id, c.address, c.city, c.state, c.pincode, c.notes
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.id = $1 AND r.name = 'CUSTOMER'`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    const scope = await getStaffScope(req.user.id);
    if (scope.isDoctor) {
      const assigned = await db.query(
        'SELECT 1 FROM appointments ap JOIN customers cc ON cc.id = ap.customer_id WHERE cc.user_id = $1 AND ap.doctor_id = $2 LIMIT 1',
        [req.params.id, scope.doctorId]
      );
      if (!assigned.rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/customers — create customer (by admin/staff)
exports.createCustomer = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, email, address, city, state, pincode, notes } = req.body;
    // Stored in the canonical form the mobile app and website use, so this customer can sign in to the app with an OTP.
    const mobile = req.body.mobile ? canonicalMobile(req.body.mobile) : null;
    if (req.body.mobile && !mobile) return res.status(400).json({ success: false, message: 'Enter a valid mobile number' });

    // A customer who phones the clinic is registered here and then signs in to the app/website with this mobile number
    // and an OTP. No password is created; email is optional.
    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'Name and mobile number are required' });
    }
    if (String(name).trim().length < 2 || String(name).length > 100) return res.status(400).json({ success: false, message: 'Name must be 2-100 characters' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ success: false, message: 'Enter a valid email address' });

    const identifier_type = 'MOBILE';
    const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    const roleResult = await db.query("SELECT id FROM roles WHERE name = 'CUSTOMER'");
    const roleId = roleResult.rows[0].id;

    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, mobile`,
      [name, email || null, mobile || null, password_hash, identifier_type, roleId, req.user.id]
    );

    const userId = userResult.rows[0].id;

    const custResult = await client.query(
      `INSERT INTO customers (user_id, address, city, state, pincode, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, address || null, city || null, state || null, pincode || null, notes || null, req.user.id]
    );

    await client.query('COMMIT');

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'CUSTOMER_CREATED', 'CUSTOMERS', userId, JSON.stringify({ name, email, mobile }), req.ip]
    );

    res.status(201).json({
      success: true,
      data: { ...userResult.rows[0], customer_id: custResult.rows[0].id },
      message: 'Customer created successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Email or mobile already in use' });
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  } finally {
    client.release();
  }
};

// PUT /api/customers/:id
exports.updateCustomer = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, address, city, state, pincode, notes, status } = req.body;
    const { id } = req.params;

    await client.query('BEGIN');

    if (name || status) {
      await client.query(
        'UPDATE users SET name=COALESCE($1,name), status=COALESCE($2,status), updated_at=NOW() WHERE id=$3',
        [name, status, id]
      );
    }

    await client.query(
      `INSERT INTO customers (user_id, address, city, state, pincode, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id) DO UPDATE
       SET address=COALESCE(EXCLUDED.address, customers.address),
           city=COALESCE(EXCLUDED.city, customers.city),
           state=COALESCE(EXCLUDED.state, customers.state),
           pincode=COALESCE(EXCLUDED.pincode, customers.pincode),
           notes=COALESCE(EXCLUDED.notes, customers.notes),
           updated_at=NOW()`,
      [id, address, city, state, pincode, notes]
    );

    await client.query('COMMIT');

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'CUSTOMER_UPDATED', 'CUSTOMERS', id, JSON.stringify(req.body), req.ip]
    );

    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  } finally {
    client.release();
  }
};

// PATCH /api/customers/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const user = await db.query('SELECT status FROM users WHERE id = $1', [req.params.id]);
    if (!user.rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    const newStatus = user.rows[0].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await db.query('UPDATE users SET status=$1, updated_at=NOW() WHERE id=$2', [newStatus, req.params.id]);
    res.json({ success: true, message: `Customer ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
