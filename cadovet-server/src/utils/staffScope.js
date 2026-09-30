const db = require('../database');

// Who is calling, for row-level rules. A DOCTOR only ever sees the work assigned to them; everyone else with the
// matching permission sees all rows. A doctor account without a doctor profile sees nothing (doctorId -1 matches no row).
// departmentName is the caller's desk (e.g. MEDICINE = the Pharmacy desk, INVENTORY = the Inventory desk) — used to
// scope the Pharmacy/Inventory pages to "their own place" while ADMIN sees every department.
//
// A staff member can be rostered at more than one branch (`locations`, via `user_locations`); `activeLocationId` is
// whichever one they're currently working out of (`users.active_location_id`, switched from the UI — see
// locationController.setActiveLocation). It's read fresh here, never cached in the JWT, so switching branches takes
// effect immediately. ADMIN is never location-locked and has no rows in `user_locations`.
exports.getStaffScope = async (userId) => {
  const r = await db.query(
    `SELECT r.name AS role, doc.id AS doctor_id, dept.name AS department_name, u.active_location_id
     FROM users u JOIN roles r ON r.id = u.role_id
     LEFT JOIN doctors doc ON doc.user_id = u.id
     LEFT JOIN departments dept ON dept.id = u.department_id
     WHERE u.id = $1`,
    [userId]
  );
  const row = r.rows[0] || {};
  const locs = await db.query(
    `SELECT l.id, l.name FROM user_locations ul JOIN locations l ON l.id = ul.location_id WHERE ul.user_id = $1 ORDER BY l.name`,
    [userId]
  );
  return {
    role: row.role || null,
    isDoctor: row.role === 'DOCTOR',
    doctorId: row.doctor_id ?? -1,
    departmentName: row.department_name || null,
    activeLocationId: row.active_location_id ?? null,
    locations: locs.rows,
  };
};

// Replaces a staff member's branch roster (used by user/doctor create+update). If their current active_location_id
// is no longer in the new set, it's reset to the first location given (or cleared if none) so it never points at a
// branch they're no longer assigned to.
exports.setUserLocations = async (userId, locationIds) => {
  const ids = [...new Set((locationIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  await db.query('DELETE FROM user_locations WHERE user_id = $1', [userId]);
  for (const locId of ids) {
    await db.query('INSERT INTO user_locations (user_id, location_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, locId]);
  }
  const current = await db.query('SELECT active_location_id FROM users WHERE id = $1', [userId]);
  if (!ids.includes(current.rows[0]?.active_location_id)) {
    await db.query('UPDATE users SET active_location_id = $1 WHERE id = $2', [ids[0] || null, userId]);
  }
};

// Does this role hold the permission? (Used where one route serves several roles and one of them needs an extra right.)
exports.hasPermission = async (roleId, permission) => {
  const r = await db.query(
    'SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1 AND p.name = $2',
    [roleId, permission]
  );
  return r.rowCount > 0;
};
