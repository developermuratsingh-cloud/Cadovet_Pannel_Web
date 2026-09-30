const db = require('../database');

// GET /api/roles
exports.listRoles = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.id, r.name, r.description,
             COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id ORDER BY r.id
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/roles/:id
exports.getRole = async (req, res) => {
  try {
    const role = await db.query('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    if (!role.rows.length) return res.status(404).json({ success: false, message: 'Role not found' });

    const perms = await db.query(
      `SELECT p.id, p.name, p.description FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = $1 ORDER BY p.name`, [req.params.id]
    );

    res.json({ success: true, data: { ...role.rows[0], permissions: perms.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/roles
exports.createRole = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Role name is required' });

    const result = await db.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
      [name.toUpperCase(), description]
    );

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'ROLE_CHANGED', 'ROLES', result.rows[0].id, JSON.stringify(result.rows[0]), req.ip]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Role created successfully' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Role already exists' });
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PUT /api/roles/:id/permissions — assign permissions to role
exports.assignPermissions = async (req, res) => {
  try {
    const { permission_ids } = req.body;
    const { id } = req.params;

    const role = await db.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (!role.rows.length) return res.status(404).json({ success: false, message: 'Role not found' });

    // Remove existing and re-add
    await db.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

    if (permission_ids && permission_ids.length > 0) {
      const values = permission_ids.map((_, i) => `($1, $${i + 2})`).join(',');
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
        [id, ...permission_ids]
      );
    }

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'PERMISSION_CHANGED', 'ROLES', id, JSON.stringify({ role_id: id, permission_ids }), req.ip]
    );

    res.json({ success: true, message: 'Permissions updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
