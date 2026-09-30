const db = require('../database');

// GET /api/audit-logs
exports.listAuditLogs = async (req, res) => {
  try {
    const { action, module, user_id, page = 1, limit = 50, from_date, to_date } = req.query;
    const offset = (page - 1) * limit;
    let where = [];
    let params = [];
    let idx = 1;

    if (action) { where.push(`al.action = $${idx++}`); params.push(action); }
    if (module) { where.push(`al.module = $${idx++}`); params.push(module); }
    if (user_id) { where.push(`al.user_id = $${idx++}`); params.push(user_id); }
    if (from_date) { where.push(`al.created_at >= $${idx++}`); params.push(from_date); }
    if (to_date) { where.push(`al.created_at <= $${idx++}`); params.push(to_date); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM audit_logs al ${whereClause}`, params
    );

    const result = await db.query(
      `SELECT al.id, al.action, al.module, al.record_id, al.old_value, al.new_value,
              al.ip_address, al.created_at,
              u.name as user_name, u.email as user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
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
