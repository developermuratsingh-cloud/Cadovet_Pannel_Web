const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { canonicalMobile } = require('../utils/mobile');
const { validatePassword } = require('../utils/validation');
const { getStaffScope, setUserLocations } = require('../utils/staffScope');

// GET /api/doctors?location_id=
// OPERATIONAL_HEAD/PHARMACY/INVENTORY are locked to whoever's rostered at the branch they're currently working
// from — never widened by a query param, so a Pharmacy desk at Branch A can't browse Branch B's doctor list.
// ADMIN and CUSTOMER aren't branch-scoped; location_id is just an optional filter for them (e.g. "doctors at the
// branch I'm booking at").
exports.listDoctors = async (req, res) => {
  try {
    const scope = await getStaffScope(req.user.id);
    const where = ["d.status = 'ACTIVE'", "u.status = 'ACTIVE'"];
    const params = [];
    let idx = 1;

    if (['OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY'].includes(scope.role)) {
      if (!scope.activeLocationId) {
        where.push('1 = 0');
      } else {
        where.push(`EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = d.user_id AND ul.location_id = $${idx++})`);
        params.push(scope.activeLocationId);
      }
    } else if (req.query.location_id) {
      where.push(`EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = d.user_id AND ul.location_id = $${idx++})`);
      params.push(req.query.location_id);
    }

    const result = await db.query(`
      SELECT d.id, d.user_id, u.name, u.email, u.mobile,
             d.specialization, d.qualification, d.experience_years,
             d.consultation_fee, d.available_days, d.available_from, d.available_to,
             d.bio, d.rating, d.status
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY d.rating DESC, u.name ASC
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listDoctors error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/doctors/public?location_id=  — the website's "choose a branch, see who's there" browsing list.
exports.listPublicDoctors = async (req, res) => {
  try {
    const where = ["d.status = 'ACTIVE'", "u.status = 'ACTIVE'"];
    const params = [];
    if (req.query.location_id) {
      where.push(`EXISTS (SELECT 1 FROM user_locations ul WHERE ul.user_id = d.user_id AND ul.location_id = $1)`);
      params.push(req.query.location_id);
    }
    const result = await db.query(`
      SELECT d.id, d.user_id, u.name, d.specialization AS title,
             d.qualification AS qualification, d.experience_years,
             d.consultation_fee AS price, d.bio, d.rating, d.status,
             COALESCE(d.specialization, u.name) AS subtitle
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY d.rating DESC, u.name ASC
      LIMIT 4
    `, params);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('listPublicDoctors error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/doctors/:id
exports.getDoctor = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT d.*, u.name, u.email, u.mobile
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = $1
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Doctor not found' });
    const locs = await db.query(
      `SELECT l.id, l.name FROM user_locations ul JOIN locations l ON l.id = ul.location_id WHERE ul.user_id = $1 ORDER BY l.name`,
      [result.rows[0].user_id]
    );
    res.json({ success: true, data: { ...result.rows[0], locations: locs.rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PUT /api/doctors/:id
exports.updateDoctor = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { specialization, qualification, experience_years, consultation_fee, available_days, available_from, available_to, bio, status } = req.body;
    const problem = scheduleError({ available_days, available_from, available_to });
    if (problem) return res.status(400).json({ success: false, message: problem });
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    // Removing a doctor who has left: we never hard-delete the row (it would either orphan or, for anything
    // dispensed to them, be flat-out rejected by the DB's foreign keys) — deactivating both the doctor profile
    // and their login is what "remove this doctor" actually means. Appointment/prescription/medicine history
    // stays intact and correctly attributed; they just disappear from the active directory and can't sign in.
    if (status === 'INACTIVE') {
      const upcoming = await client.query(
        `SELECT COUNT(*)::int AS n FROM appointments
         WHERE doctor_id = $1 AND appointment_date >= CURRENT_DATE AND status IN ('PENDING', 'CONFIRMED')`,
        [id]
      );
      if (upcoming.rows[0].n > 0) {
        return res.status(400).json({
          success: false,
          message: `This doctor has ${upcoming.rows[0].n} upcoming appointment${upcoming.rows[0].n === 1 ? '' : 's'} — reassign or cancel ${upcoming.rows[0].n === 1 ? 'it' : 'them'} first.`,
        });
      }
    }

    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE doctors SET
        specialization = COALESCE($1, specialization),
        qualification = COALESCE($2, qualification),
        experience_years = COALESCE($3, experience_years),
        consultation_fee = COALESCE($4, consultation_fee),
        available_days = COALESCE($5, available_days),
        available_from = COALESCE($6, available_from),
        available_to = COALESCE($7, available_to),
        bio = COALESCE($8, bio),
        status = COALESCE($9, status),
        updated_at = NOW()
      WHERE id = $10 RETURNING *
    `, [specialization, qualification, experience_years, consultation_fee, available_days, available_from, available_to, bio, status, id]);

    if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Doctor not found' }); }

    // Keep the login in lockstep with the profile — an INACTIVE doctor can no longer sign in; re-activating
    // the profile (rejoining) opens their login back up too.
    if (status !== undefined) {
      await client.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, result.rows[0].user_id]);
    }

    // Which branch(es) this doctor is rostered at — sent as a whole-roster replacement, same convention as
    // userController.updateUser. Must leave at least one branch; a doctor with none is unreachable everywhere.
    if (Array.isArray(req.body.location_ids)) {
      if (req.body.location_ids.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ success: false, message: 'A doctor must be rostered at least one branch' }); }
      await setUserLocations(result.rows[0].user_id, req.body.location_ids);
    }

    await client.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, status === 'INACTIVE' ? 'DOCTOR_REMOVED' : 'DOCTOR_UPDATED', 'DOCTORS', id, JSON.stringify({ status }), req.ip]
    );
    await client.query('COMMIT');

    res.json({ success: true, data: result.rows[0], message: status === 'INACTIVE' ? 'Doctor removed' : status === 'ACTIVE' ? 'Doctor re-activated' : 'Doctor profile updated' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  } finally {
    client.release();
  }
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

// Returns an error message, or null when the schedule is usable.
const scheduleError = ({ available_days, available_from, available_to }) => {
  if (available_days !== undefined) {
    const days = String(available_days).split(',').map((d) => d.trim());
    if (!days.length || days.some((d) => !DAYS.includes(d))) return 'Working days must be a comma-separated list such as Mon,Tue,Wed';
  }
  if (available_from !== undefined && !TIME.test(String(available_from))) return 'Start time must look like 09:00';
  if (available_to !== undefined && !TIME.test(String(available_to))) return 'End time must look like 18:00';
  if (available_from !== undefined && available_to !== undefined && String(available_from) >= String(available_to)) return 'End time must be after the start time';
  return null;
};
exports.scheduleError = scheduleError;

// POST /api/doctors  — registers a doctor: a DOCTOR user (signs in with email + password) plus the profile that appointments are assigned to.
exports.createDoctor = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { name, email, specialization, qualification, experience_years = 0, consultation_fee = 500, bio } = req.body;
    const { password } = req.body;
    const location_ids = [...new Set((Array.isArray(req.body.location_ids) ? req.body.location_ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    const mobile = req.body.mobile ? canonicalMobile(req.body.mobile) : null;
    if (!name || String(name).trim().length < 2 || String(name).length > 100) return res.status(400).json({ success: false, message: 'Name must be 2-100 characters' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email)) || String(email).length > 255) return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    if (req.body.mobile && !mobile) return res.status(400).json({ success: false, message: 'Enter a valid mobile number' });
    const passwordProblem = validatePassword(password);
    if (passwordProblem) return res.status(400).json({ success: false, message: passwordProblem });
    if (!specialization || String(specialization).length > 150) return res.status(400).json({ success: false, message: 'Specialization is required' });
    if (location_ids.length === 0) return res.status(400).json({ success: false, message: 'Assign at least one branch for this doctor' });
    const fee = Number(consultation_fee);
    const years = Number(experience_years);
    if (!Number.isFinite(fee) || fee < 0 || fee > 100000) return res.status(400).json({ success: false, message: 'Invalid consultation fee' });
    if (!Number.isInteger(years) || years < 0 || years > 70) return res.status(400).json({ success: false, message: 'Invalid experience' });
    const schedule = {
      available_days: req.body.available_days ?? 'Mon,Tue,Wed,Thu,Fri,Sat',
      available_from: req.body.available_from ?? '09:00',
      available_to: req.body.available_to ?? '18:00',
    };
    const problem = scheduleError(schedule);
    if (problem) return res.status(400).json({ success: false, message: problem });

    // A temporary password set by the administrator; the doctor must replace it at first sign-in.
    const hash = await bcrypt.hash(password, 10);
    await client.query('BEGIN');
    const user = await client.query(
      `INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, department_id, created_by, must_change_password)
       VALUES ($1, $2, $3, $4, 'EMAIL', (SELECT id FROM roles WHERE name = 'DOCTOR'), (SELECT id FROM departments WHERE name = 'DOCTOR'), $5, TRUE)
       RETURNING id, name, email, mobile`,
      [String(name).trim(), String(email).trim(), mobile, hash, req.user.id]
    );
    const doc = await client.query(
      `INSERT INTO doctors (user_id, specialization, qualification, experience_years, consultation_fee, available_days, available_from, available_to, bio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [user.rows[0].id, specialization, qualification || null, years, fee, schedule.available_days, schedule.available_from, schedule.available_to, bio || null]
    );
    const validLocs = await client.query("SELECT id FROM locations WHERE id = ANY($1) AND status = 'ACTIVE'", [location_ids]);
    if (validLocs.rows.length !== location_ids.length) throw Object.assign(new Error('Invalid branch'), { status: 400, clientMessage: 'One or more selected branches are invalid or inactive' });
    for (const locId of location_ids) {
      await client.query('INSERT INTO user_locations (user_id, location_id) VALUES ($1, $2)', [user.rows[0].id, locId]);
    }
    await client.query('UPDATE users SET active_location_id = $1 WHERE id = $2', [location_ids[0], user.rows[0].id]);
    await client.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'DOCTOR_CREATED', 'DOCTORS', doc.rows[0].id, JSON.stringify({ name, mobile, specialization }), req.ip]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { ...doc.rows[0], name: user.rows[0].name, mobile: user.rows[0].mobile, email: user.rows[0].email }, message: 'Doctor added' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Email or mobile already in use' });
    if (err.status) return res.status(err.status).json({ success: false, message: err.clientMessage });
    console.error('createDoctor error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  } finally {
    client.release();
  }
};
