const db = require('../database');

// GET /api/permissions
exports.listPermissions = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM permissions ORDER BY name');
    // Group by module prefix
    const grouped = {};
    result.rows.forEach(p => {
      const module = p.name.split('_')[0];
      if (!grouped[module]) grouped[module] = [];
      grouped[module].push(p);
    });
    res.json({ success: true, data: result.rows, grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/departments
exports.listDepartments = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM departments ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};
