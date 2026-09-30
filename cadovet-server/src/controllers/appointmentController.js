const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { canonicalMobile } = require('../utils/mobile');
const { getCustomerScope } = require('../utils/scope');
const { validateBookingDate } = require('../utils/validation');
const { resolveCoupon } = require('./couponController');
const { SLOT_MINUTES, ACTIVE_STATUSES, WEEKDAYS, toMinutes, toSlotLabel, isPositiveInt, checkSlot, checkClinicSlot, clinicSlots, isClockTime, withSlotLock, isSlotConflict, isPastSlot, isEmergencyMinutes } = require('../utils/slots');
const { getStaffScope, hasPermission } = require('../utils/staffScope');
const { isEmergencyTime, effectivePrice, repriceUnpaidInvoice } = require('../utils/emergency');

const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
const fail = (res, status, message) => res.status(status).json({ success: false, message });

// GET /api/appointments/availability?doctor_id=&date=YYYY-MM-DD
// Slots are derived from the doctor's working days/hours minus already-booked slots.
exports.getAvailability = async (req, res) => {
  try {
    const { doctor_id, date, location_id } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      return fail(res, 400, 'date (YYYY-MM-DD) is required');
    }
    // Without a doctor: the clinic's slots at the given branch (or the caller's own active branch for staff), which
    // is what a customer chooses from. A time is offered while fewer open requests exist than doctors working then
    // at that branch; the operational head picks the doctor afterwards.
    if (doctor_id === undefined || doctor_id === '') {
      let locId = location_id ? Number(location_id) : null;
      if (!locId) {
        const scope = await getStaffScope(req.user.id);
        if (scope.role !== 'ADMIN') locId = scope.activeLocationId;
      }
      return res.json({ success: true, data: { date, doctor_id: null, slots: await clinicSlots(date, locId) } });
    }
    // With a doctor: that doctor's own free slots, used when assigning.
    if (!isPositiveInt(doctor_id)) return fail(res, 400, 'doctor_id must be a number');

    const docRes = await db.query(
      "SELECT id, available_days, available_from, available_to FROM doctors WHERE id = $1 AND status = 'ACTIVE'",
      [doctor_id]
    );
    if (!docRes.rows.length) return res.status(404).json({ success: false, message: 'Doctor not found' });
    const doc = docRes.rows[0];

    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const workingDays = String(doc.available_days || '').split(',').map((d) => d.trim());
    const worksToday = workingDays.includes(weekday);

    const bookedRes = await db.query(
      `SELECT UPPER(TRIM(appointment_time)) AS t FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND status = ANY($3)`,
      [doc.id, date, ACTIVE_STATUSES]
    );
    const booked = new Set(bookedRes.rows.map((r) => r.t));

    // The doctor's usual hours on a working day, plus every emergency-hours slot (9 PM - 9 AM): any doctor can be put on
    // an emergency visit, so those are not limited to their working days or hours (see checkSlot).
    const minutes = new Set();
    if (worksToday) {
      for (let t = toMinutes(doc.available_from); t + SLOT_MINUTES <= toMinutes(doc.available_to); t += SLOT_MINUTES) minutes.add(t);
    }
    for (let t = 0; t < 24 * 60; t += SLOT_MINUTES) if (isEmergencyMinutes(t)) minutes.add(t);

    const slots = [...minutes]
      .sort((a, b) => a - b)
      .filter((t) => !isPastSlot(date, t))
      .map((t) => {
        const time = toSlotLabel(t);
        return { time, available: !booked.has(time.toUpperCase()), emergency: isEmergencyMinutes(t) };
      });

    res.json({ success: true, data: { date, doctor_id: doc.id, slots } });
  } catch (err) {
    console.error('getAvailability error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PATCH /api/appointments/:id/cancel  (customer self-service)
exports.cancelAppointment = async (req, res) => {
  try {
    const { isCustomer, customerId } = await getCustomerScope(req.user.id);
    const existing = await db.query('SELECT id, customer_id, status, location_id FROM appointments WHERE id = $1', [req.params.id]);
    const appt = existing.rows[0];
    if (!appt || (isCustomer && appt.customer_id !== customerId)) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (!isCustomer) {
      const scope = await getStaffScope(req.user.id);
      if (scope.role === 'OPERATIONAL_HEAD' && appt.location_id !== scope.activeLocationId) {
        return res.status(404).json({ success: false, message: 'Appointment not found' });
      }
    }
    if (!ACTIVE_STATUSES.includes(appt.status)) {
      return res.status(400).json({ success: false, message: `A ${appt.status.toLowerCase()} appointment cannot be cancelled` });
    }

    const result = await db.query(
      "UPDATE appointments SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 RETURNING *",
      [appt.id]
    );
    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'APPOINTMENT_CANCELLED', 'APPOINTMENTS', appt.id, JSON.stringify({ status: 'CANCELLED' }), req.ip]
    );
    res.json({ success: true, data: result.rows[0], message: 'Appointment cancelled' });
  } catch (err) {
    console.error('cancelAppointment error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PATCH /api/appointments/:id/reschedule  { appointment_date, appointment_time }  (customer self-service)
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointment_date, appointment_time } = req.body;
    if (!appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, message: 'Date and time are required' });
    }
    const dateError = validateBookingDate(appointment_date);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    const { isCustomer, customerId } = await getCustomerScope(req.user.id);
    const existing = await db.query(
      'SELECT id, customer_id, doctor_id, status, is_emergency FROM appointments WHERE id = $1',
      [req.params.id]
    );
    const appt = existing.rows[0];
    if (!appt || (isCustomer && appt.customer_id !== customerId)) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (!ACTIVE_STATUSES.includes(appt.status)) {
      return res.status(400).json({ success: false, message: `A ${appt.status.toLowerCase()} appointment cannot be rescheduled` });
    }

    // A customer picks a clinic time, not a doctor, so an already-assigned visit goes back to the operational head's
    // queue to be assigned again. Staff move a visit and keep its doctor (whose schedule then has to fit).
    const backToQueue = isCustomer && !!appt.doctor_id;
    const clinicPath = isCustomer || !appt.doctor_id;
    const outcome = await (clinicPath ? withSlotLock : (d, t, f) => f(db.query.bind(db)))(appointment_date, appointment_time, async (q) => {
      const slot = clinicPath
        ? await checkClinicSlot({ date: appointment_date, time: appointment_time, excludeId: appt.id, q })
        : await checkSlot({ doctorId: appt.doctor_id, date: appointment_date, time: appointment_time, excludeId: appt.id });
      if (slot.error) return { error: slot.error };
      const nowEmergency = isEmergencyTime(slot.time);
      const updated = await q(
        `UPDATE appointments SET appointment_date = $1, appointment_time = $2, is_emergency = $4,
           ${backToQueue ? "doctor_id = NULL, status = 'PENDING', assigned_by = NULL, assigned_at = NULL," : ''} updated_at = NOW()
         WHERE id = $3 RETURNING *`,
        [appointment_date, slot.time, appt.id, nowEmergency]
      );
      // Moving into or out of emergency hours changes what the visit costs: re-price an invoice that is still unpaid.
      if (nowEmergency !== appt.is_emergency) await repriceUnpaidInvoice(q, appt.id);
      return { row: updated.rows[0], time: slot.time };
    });
    if (outcome.error) return fail(res, outcome.error.status, outcome.error.message);
    const result = { rows: [outcome.row] };
    const slot = { time: outcome.time };

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'APPOINTMENT_RESCHEDULED', 'APPOINTMENTS', appt.id, JSON.stringify({ appointment_date, appointment_time: slot.time, back_to_queue: backToQueue }), req.ip]
    );
    res.json({ success: true, data: result.rows[0], message: backToQueue ? 'Appointment rescheduled; it will be confirmed again' : 'Appointment rescheduled' });
  } catch (err) {
    if (isSlotConflict(err)) return fail(res, 409, 'That time slot is no longer available');
    console.error('rescheduleAppointment error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/appointments
exports.listAppointments = async (req, res) => {
  try {
    const { status, date, doctor_id, customer_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const scope = await getStaffScope(req.user.id);
    const userRole = scope.role;

    let where = [];
    let params = [];
    let idx = 1;

    // Customers see their own; a DOCTOR sees only the appointments assigned to them (never the unassigned queue);
    // the operational head and admin see everything and can filter.
    if (userRole === 'CUSTOMER') {
      let custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length) {
        return res.json({ success: true, data: [], pagination: { total: 0 } });
      }
      where.push(`a.customer_id = $${idx++}`);
      params.push(custResult.rows[0].id);
    } else if (scope.isDoctor) {
      // A doctor's queue is forward-looking only: today and upcoming visits assigned to them by the
      // operational head. A past visit belongs to clinical history (Clinical Records / Prescriptions), not here.
      // "Assigned" means it went through the assignment workflow (assigned_at set) - a doctor_id present for some
      // other reason (e.g. data predating this workflow) never counts as this doctor's patient.
      where.push(`a.doctor_id = $${idx++} AND a.assigned_at IS NOT NULL`);
      params.push(scope.doctorId);
      where.push('a.appointment_date >= CURRENT_DATE');
    } else {
      if (doctor_id) {
        if (!isPositiveInt(doctor_id)) return fail(res, 400, 'doctor_id must be a number');
        where.push(`a.doctor_id = $${idx++}`);
        params.push(doctor_id);
      }
      if (customer_id) {
        if (!isPositiveInt(customer_id)) return fail(res, 400, 'customer_id must be a number');
        where.push(`a.customer_id = $${idx++}`);
        params.push(customer_id);
      }
      if (req.query.assigned === 'false') where.push('a.doctor_id IS NULL');
      if (req.query.assigned === 'true') where.push('a.doctor_id IS NOT NULL');
      if (req.query.emergency === 'true') where.push('a.is_emergency = TRUE');
      if (req.query.emergency === 'false') where.push('a.is_emergency = FALSE');
      if (['APP', 'WEBSITE', 'STAFF'].includes(req.query.source)) {
        where.push(`a.source = $${idx++}`);
        params.push(req.query.source);
      }
      // ADMIN sees every branch and can filter explicitly; the operational head is locked to whichever branch
      // they're currently working from — they manage one branch's queue at a time.
      if (userRole === 'ADMIN') {
        if (req.query.location_id) {
          where.push(`a.location_id = $${idx++}`);
          params.push(req.query.location_id);
        }
      } else if (scope.activeLocationId) {
        where.push(`a.location_id = $${idx++}`);
        params.push(scope.activeLocationId);
      } else {
        where.push('1 = 0');
      }
    }

    if (status && status !== 'ALL') {
      where.push(`a.status = $${idx++}`);
      params.push(status);
    }

    if (date) {
      where.push(`a.appointment_date = $${idx++}`);
      params.push(date);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countRes = await db.query(`
      SELECT COUNT(*)
      FROM appointments a
      JOIN pets p ON a.pet_id = p.id
      JOIN customers c ON a.customer_id = c.id
      JOIN users cu ON c.user_id = cu.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users du ON d.user_id = du.id
      LEFT JOIN services s ON a.service_id = s.id
      ${whereClause}
    `, params);

    const result = await db.query(`
      SELECT a.id, a.customer_id, a.pet_id, a.doctor_id, a.service_id, a.location_id,
             a.appointment_date, a.appointment_time, a.reason, a.notes, a.status, a.created_at,
             a.coupon_code, a.discount_amount, a.source, a.assigned_at, a.is_emergency,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             cu.name as customer_name, cu.email as customer_email, cu.mobile as customer_mobile,
             du.name as doctor_name, d.specialization as doctor_specialization,
             s.name as service_name, s.price as service_price, s.emergency_price as service_emergency_price, s.duration_minutes,
             CASE WHEN a.is_emergency AND s.emergency_price IS NOT NULL THEN s.emergency_price ELSE s.price END as charged_price,
             l.name as location_name
      FROM appointments a
      JOIN pets p ON a.pet_id = p.id
      JOIN customers c ON a.customer_id = c.id
      JOIN users cu ON c.user_id = cu.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users du ON d.user_id = du.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN locations l ON l.id = a.location_id
      ${whereClause}
      ORDER BY ${req.query.assigned === 'false' ? 'a.is_emergency DESC, a.appointment_date ASC, a.created_at ASC' : 'a.appointment_date DESC, a.created_at DESC'}
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countRes.rows[0]?.count || 0),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((countRes.rows[0]?.count || 0) / limit)
      }
    });
  } catch (err) {
    console.error('listAppointments error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// GET /api/appointments/:id
exports.getAppointment = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*,
             p.name as pet_name, p.species as pet_species, p.breed as pet_breed,
             cu.name as customer_name, cu.email as customer_email, cu.mobile as customer_mobile,
             du.name as doctor_name, d.specialization as doctor_specialization,
             s.name as service_name, s.price as service_price, s.emergency_price as service_emergency_price,
             CASE WHEN a.is_emergency AND s.emergency_price IS NOT NULL THEN s.emergency_price ELSE s.price END as charged_price
      FROM appointments a
      JOIN pets p ON a.pet_id = p.id
      JOIN customers c ON a.customer_id = c.id
      JOIN users cu ON c.user_id = cu.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users du ON d.user_id = du.id
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.id = $1
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Appointment not found' });

    const { isCustomer, customerId } = await getCustomerScope(req.user.id);
    if (isCustomer && result.rows[0].customer_id !== customerId) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    const scope = await getStaffScope(req.user.id);
    if (scope.isDoctor && (result.rows[0].doctor_id !== scope.doctorId || !result.rows[0].assigned_at)) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (scope.role === 'OPERATIONAL_HEAD' && result.rows[0].location_id !== scope.activeLocationId) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/appointments
exports.createAppointment = async (req, res) => {
  try {
    const { pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, customer_id } = req.body;

    if (!pet_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ success: false, message: 'Pet, date, and time are required' });
    }
    const dateError = validateBookingDate(appointment_date);
    if (dateError) return res.status(400).json({ success: false, message: dateError });
    if (notes && String(notes).length > 500) {
      return res.status(400).json({ success: false, message: 'Notes must be at most 500 characters' });
    }
    // Emergency hours (9 PM - 9 AM): decided from the time by the server, never taken from the client.
    const emergency = isEmergencyTime(appointment_time);

    const scope = await getStaffScope(req.user.id);
    const isCust = scope.role === 'CUSTOMER';

    // Which branch is this visit at? Staff booking on someone's behalf default to their own active branch (the
    // desk they're sitting at); a customer picking a branch explicitly is honoured, otherwise the clinic's one
    // (or first, for a multi-branch clinic whose booking form hasn't been updated yet) is used.
    let locationId = req.body.location_id ? Number(req.body.location_id) : (!isCust ? scope.activeLocationId : null);
    if (!locationId) {
      const fallback = await db.query("SELECT id FROM locations WHERE status = 'ACTIVE' ORDER BY id LIMIT 1");
      locationId = fallback.rows[0]?.id || null;
    }
    if (!locationId) return fail(res, 400, 'No active branch is configured yet');
    const locCheck = await db.query("SELECT 1 FROM locations WHERE id = $1 AND status = 'ACTIVE'", [locationId]);
    if (!locCheck.rows.length) return fail(res, 400, 'Selected branch is invalid or inactive');

    // Whose appointment is it? A customer books for themselves; staff (operational head, admin) book for a customer
    // who phoned in, and must say which one.
    let custId;
    if (isCust) {
      let custResult = await db.query('SELECT id FROM customers WHERE user_id = $1', [req.user.id]);
      if (!custResult.rows.length) custResult = await db.query('INSERT INTO customers (user_id) VALUES ($1) RETURNING id', [req.user.id]);
      custId = custResult.rows[0].id;
    } else {
      if (!isPositiveInt(customer_id)) return fail(res, 400, 'Select the customer this appointment is for');
      const known = await db.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
      if (!known.rows.length) return fail(res, 400, 'Customer not found');
      custId = known.rows[0].id;
    }

    if (!isPositiveInt(pet_id)) return fail(res, 400, 'Selected pet does not belong to this customer');
    const petCheck = await db.query('SELECT id FROM pets WHERE id = $1 AND customer_id = $2', [pet_id, custId]);
    if (!petCheck.rows.length) {
      return res.status(400).json({ success: false, message: 'Selected pet does not belong to this customer' });
    }

    // A request waits for the operational head to assign a doctor. Only staff who may assign can name the doctor up front
    // (a call-in booking); a doctor_id from a customer is ignored.
    const wantsDoctor = doctor_id !== undefined && doctor_id !== null && doctor_id !== '';
    const assignNow = !isCust && wantsDoctor;
    if (assignNow && !(await hasPermission(req.user.role_id, 'APPOINTMENT_ASSIGN'))) {
      return fail(res, 403, 'You are not allowed to assign a doctor');
    }
    if (service_id !== undefined && service_id !== null && service_id !== '') {
      const svc = isPositiveInt(service_id) ? await db.query('SELECT 1 FROM services WHERE id = $1 AND is_active = true', [service_id]) : { rows: [] };
      if (!svc.rows.length) return fail(res, 400, 'Service not found');
    }

    // Optional coupon: the discount is always computed here from the service price, never taken from the client.
    let couponCode = null;
    let discountAmount = 0;
    if (req.body.coupon_code) {
      if (!service_id) return res.status(400).json({ success: false, message: 'Select a service to use a coupon' });
      const svc = await db.query('SELECT price, emergency_price FROM services WHERE id = $1', [service_id]);
      if (!svc.rows.length) return res.status(400).json({ success: false, message: 'Service not found' });
      const applied = await resolveCoupon(req.body.coupon_code, effectivePrice(svc.rows[0], emergency));
      if (applied.error) return res.status(400).json({ success: false, message: applied.error });
      couponCode = applied.coupon.code;
      discountAmount = applied.discount;
    }

    const source = isCust ? (['APP', 'WEBSITE'].includes(req.body.source) ? req.body.source : 'APP') : 'STAFF';
    // Doctor-specific bookings are guarded by the unique index; clinic requests by a per-slot lock (see withSlotLock).
    const outcome = await (assignNow ? (d, t, f) => f(db.query.bind(db)) : withSlotLock)(appointment_date, appointment_time, async (q) => {
      const slot = assignNow
        ? await checkSlot({ doctorId: doctor_id, date: appointment_date, time: appointment_time, locationId })
        : await checkClinicSlot({ date: appointment_date, time: appointment_time, locationId, q });
      if (slot.error) return { error: slot.error };
      const inserted = await q(`
        INSERT INTO appointments (customer_id, pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, status, created_by,
                                  coupon_code, discount_amount, source, assigned_by, assigned_at, location_id, is_emergency)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `, [custId, pet_id, assignNow ? Number(doctor_id) : null, service_id || null, appointment_date, slot.time, reason || null, notes || null,
          assignNow ? 'CONFIRMED' : 'PENDING', req.user.id, couponCode, discountAmount, source, assignNow ? req.user.id : null, assignNow ? new Date() : null, locationId, emergency]);
      return { row: inserted.rows[0], time: slot.time };
    });
    if (outcome.error) return fail(res, outcome.error.status, outcome.error.message);

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'APPOINTMENT_BOOKED', 'APPOINTMENTS', outcome.row.id, JSON.stringify({ pet_id, appointment_date, appointment_time: outcome.time, coupon_code: couponCode, source, doctor_id: assignNow ? Number(doctor_id) : null }), req.ip]
    );

    res.status(201).json({
      success: true,
      data: outcome.row,
      message: assignNow ? 'Appointment scheduled successfully!' : 'Appointment requested. We will confirm it shortly.'
    });
  } catch (err) {
    if (isSlotConflict(err)) return fail(res, 409, 'That time slot is no longer available');
    console.error('createAppointment error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PATCH /api/appointments/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const current = await db.query('SELECT id, doctor_id, appointment_date, appointment_time, status, assigned_at, location_id FROM appointments WHERE id = $1', [id]);
    const cur = current.rows[0];
    if (!cur) return res.status(404).json({ success: false, message: 'Appointment not found' });

    // A doctor works only on their own appointments, and only to finish them.
    const scope = await getStaffScope(req.user.id);
    if (scope.isDoctor) {
      if (cur.doctor_id !== scope.doctorId || !cur.assigned_at) return res.status(404).json({ success: false, message: 'Appointment not found' });
      if (status !== 'COMPLETED') return fail(res, 403, 'Doctors can only mark their appointments as completed');
      if (cur.status !== 'CONFIRMED') return fail(res, 400, 'Only a confirmed appointment can be completed');
    } else if (scope.role === 'OPERATIONAL_HEAD' && cur.location_id !== scope.activeLocationId) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    // Confirming or completing needs a doctor: that is what the operational head's assignment is for.
    if ((status === 'CONFIRMED' || status === 'COMPLETED') && !cur.doctor_id) {
      return fail(res, 400, 'Assign a doctor to this appointment first');
    }
    // Bringing an appointment back to an active status must not double-book the doctor's slot.
    if (ACTIVE_STATUSES.includes(status) && !ACTIVE_STATUSES.includes(cur.status) && cur.doctor_id) {
      const slot = await checkSlot({ doctorId: cur.doctor_id, date: cur.appointment_date, time: cur.appointment_time, excludeId: cur.id });
      if (slot.error && slot.error.status === 409) return fail(res, 409, slot.error.message);
    }

    const result = await db.query(
      'UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'APPOINTMENT_STATUS_UPDATED', 'APPOINTMENTS', id, JSON.stringify({ status }), req.ip]
    );

    res.json({ success: true, data: result.rows[0], message: `Appointment status updated to ${status}` });
  } catch (err) {
    if (isSlotConflict(err)) return fail(res, 409, 'That time slot is no longer available');
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PATCH /api/appointments/:id/assign  { doctor_id, appointment_date?, appointment_time? }   (operational head / admin)
// Sends a request to a doctor: the doctor's schedule and free slot are checked, the appointment becomes CONFIRMED and
// from then on that doctor (and only that doctor) can see it. Assigning again moves it to another doctor.
exports.assignDoctor = async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_time } = req.body;
    if (!isPositiveInt(doctor_id)) return fail(res, 400, 'Choose a doctor');

    const found = await db.query('SELECT id, doctor_id, appointment_date, appointment_time, status, location_id, is_emergency FROM appointments WHERE id = $1', [req.params.id]);
    const appt = found.rows[0];
    if (!appt) return fail(res, 404, 'Appointment not found');
    if (!ACTIVE_STATUSES.includes(appt.status)) return fail(res, 400, `A ${appt.status.toLowerCase()} appointment cannot be assigned`);

    // The operational head only assigns within the branch they're currently working from; ADMIN can act anywhere.
    const scope = await getStaffScope(req.user.id);
    if (scope.role !== 'ADMIN' && appt.location_id !== scope.activeLocationId) {
      return fail(res, 404, 'Appointment not found');
    }

    const date = appointment_date || appt.appointment_date;
    if (appointment_date) {
      const dateError = validateBookingDate(appointment_date);
      if (dateError) return fail(res, 400, dateError);
    }
    const time = appointment_time || appt.appointment_time;
    // A website doorstep request only has a time window ("10:00 AM to 12:00 PM"); a doctor needs an exact slot.
    if (!isClockTime(time)) return fail(res, 400, 'Choose an exact time slot for the doctor');

    // The doctor must be rostered at this appointment's own branch (never overridden by the query, unlike the
    // caller's own lock above — a visit's branch is fixed at booking time).
    const slot = await checkSlot({ doctorId: doctor_id, date, time, excludeId: appt.id, locationId: appt.location_id });
    if (slot.error) return fail(res, slot.error.status, slot.error.message);

    const result = await db.query(
      `UPDATE appointments SET doctor_id = $1, appointment_date = $2, appointment_time = $3, status = 'CONFIRMED',
              assigned_by = $4, assigned_at = NOW(), is_emergency = $6, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [Number(doctor_id), date, slot.time, req.user.id, appt.id, isEmergencyTime(slot.time)]
    );
    if (result.rows[0].is_emergency !== appt.is_emergency) await repriceUnpaidInvoice(db.query.bind(db), appt.id);
    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, old_value, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [req.user.id, 'APPOINTMENT_ASSIGNED', 'APPOINTMENTS', appt.id, JSON.stringify({ doctor_id: appt.doctor_id }), JSON.stringify({ doctor_id: Number(doctor_id), appointment_date: date, appointment_time: slot.time }), req.ip]
    );
    res.json({ success: true, data: result.rows[0], message: 'Doctor assigned' });
  } catch (err) {
    if (isSlotConflict(err)) return fail(res, 409, 'That time slot is no longer available');
    console.error('assignDoctor error:', err);
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// PUT /api/appointments/:id (Reschedule / update)
exports.updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { appointment_date, appointment_time, doctor_id, service_id, reason, notes, status } = req.body;

    const currentRes = await db.query('SELECT * FROM appointments WHERE id = $1', [id]);
    const cur = currentRes.rows[0];
    if (!cur) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if ((await getStaffScope(req.user.id)).isDoctor) return fail(res, 403, 'Doctors cannot edit appointments');

    if (status !== undefined && status !== null && !STATUSES.includes(status)) return fail(res, 400, 'Invalid status');
    if (notes && String(notes).length > 500) return fail(res, 400, 'Notes must be at most 500 characters');
    if (reason && String(reason).length > 255) return fail(res, 400, 'Reason must be at most 255 characters');
    if (appointment_date) {
      const dateError = validateBookingDate(appointment_date);
      if (dateError) return fail(res, 400, dateError);
    }
    if (service_id !== undefined && service_id !== null) {
      const svc = isPositiveInt(service_id) ? await db.query('SELECT 1 FROM services WHERE id = $1', [service_id]) : { rows: [] };
      if (!svc.rows.length) return fail(res, 400, 'Service not found');
    }

    // Validate the resulting doctor/date/time whenever any of them changes or the appointment becomes active again.
    const nextDoctor = doctor_id ?? cur.doctor_id;
    const nextDate = appointment_date ?? cur.appointment_date;
    const nextTime = appointment_time ?? cur.appointment_time;
    const nextStatus = status ?? cur.status;
    if ((nextStatus === 'CONFIRMED' || nextStatus === 'COMPLETED') && !nextDoctor) return fail(res, 400, 'Assign a doctor to this appointment first');
    const slotChanged = appointment_date || appointment_time || doctor_id || (ACTIVE_STATUSES.includes(nextStatus) && !ACTIVE_STATUSES.includes(cur.status));
    let storedTime = appointment_time;
    if (slotChanged) {
      const slot = await checkSlot({ doctorId: nextDoctor, date: nextDate, time: nextTime, excludeId: cur.id, locationId: cur.location_id });
      if (slot.error) return fail(res, slot.error.status, slot.error.message);
      if (appointment_time) storedTime = slot.time;
    }

    const result = await db.query(`
      UPDATE appointments SET
        appointment_date = COALESCE($1, appointment_date),
        appointment_time = COALESCE($2, appointment_time),
        doctor_id = COALESCE($3, doctor_id),
        service_id = COALESCE($4, service_id),
        reason = COALESCE($5, reason),
        notes = COALESCE($6, notes),
        status = COALESCE($7, status),
        is_emergency = $9,
        updated_at = NOW()
      WHERE id = $8 RETURNING *
    `, [appointment_date, storedTime, doctor_id, service_id, reason, notes, status, id, isEmergencyTime(storedTime ?? cur.appointment_time)]);

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (result.rows[0].is_emergency !== cur.is_emergency) await repriceUnpaidInvoice(db.query.bind(db), cur.id);
    res.json({ success: true, data: result.rows[0], message: 'Appointment updated successfully' });
  } catch (err) {
    if (isSlotConflict(err)) return fail(res, 409, 'That time slot is no longer available');
    res.status(500).json({ success: false, message: 'Server error', errors: [err.message] });
  }
};

// POST /api/appointments/public (Doorstep / Home visit booking from the website; no login)
//
// Unauthenticated, so everything here is treated as untrusted input:
//  - the phone number is validated and stored in the canonical form (the same one the app signs in with), so a guest
//    who books here can later sign in to the app with an OTP and see the booking;
//  - a booking is only ever attached to a CUSTOMER account, never to staff, and never changes a saved address;
//  - new guest accounts get a random, unusable password (there is no default credential);
//  - user/customer/pet/appointment/invoice are written in ONE transaction and race-safely, so concurrent bookings
//    neither fail nor leave half-created data behind.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v, max) => (typeof v === 'string' && v.trim().length <= max ? v.trim() : null);

exports.publicBookAppointment = async (req, res) => {
  const b = req.body || {};
  const ownerName = str(b.owner_name, 30);
  if (!ownerName || ownerName.length < 2) return fail(res, 400, 'Owner name is required (2-30 characters)');
  const mobile = canonicalMobile(b.phone);
  if (!mobile) return fail(res, 400, 'Enter a valid phone number');

  const email = b.email === undefined || b.email === null || b.email === '' ? null : str(b.email, 255);
  if (email !== null && !EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address');
  const species = b.species === undefined ? 'Dog' : str(b.species, 30);
  const breed = b.breed === undefined || b.breed === null ? null : str(b.breed, 60);
  const ageYears = b.age_years === undefined || b.age_years === null || b.age_years === '' ? null : Number(b.age_years);
  const gender = b.gender === undefined || b.gender === null || b.gender === '' ? null : str(b.gender, 10);
  const isAggressive = b.is_aggressive === undefined || b.is_aggressive === null || b.is_aggressive === '' ? false : b.is_aggressive;
  const petNameIn = b.pet_name === undefined || b.pet_name === null || b.pet_name === '' ? null : str(b.pet_name, 60);
  const address = b.address === undefined || b.address === null || b.address === '' ? null : str(b.address, 300);
  const notesIn = b.notes === undefined || b.notes === null || b.notes === '' ? null : str(b.notes, 1000);
  const serviceName = b.service_name === undefined || b.service_name === null || b.service_name === '' ? null : str(b.service_name, 120);
  const timeWindow = b.appointment_time === undefined ? '10:00 AM to 12:00 PM' : str(b.appointment_time, 60);
  const paymentMethod = b.payment_method === undefined ? 'CASH' : str(b.payment_method, 20);
  if (!species || (b.breed && breed === null) || (b.age_years !== undefined && (!Number.isFinite(ageYears) || ageYears < 0 || ageYears > 100))
      || (b.gender !== undefined && gender === null) || (gender && !['MALE', 'FEMALE', 'UNKNOWN'].includes(gender.toUpperCase()))
      || typeof isAggressive !== 'boolean' || (b.pet_name && !petNameIn) || (b.address && !address) || (b.notes && !notesIn)
      || (b.service_name && !serviceName) || !timeWindow || !paymentMethod) {
    return fail(res, 400, 'One of the fields is too long or has the wrong type');
  }

  const cart = b.cart_items === undefined ? [] : b.cart_items;
  if (!Array.isArray(cart) || cart.length > 50) return fail(res, 400, 'cart_items must be a list of at most 50 items');
  for (const i of cart) {
    if (!i || typeof i !== 'object' || (i.title !== undefined && str(i.title, 120) === null)
        || (i.price !== undefined && !(Number.isFinite(Number(i.price)) && Number(i.price) >= 0 && Number(i.price) <= 1000000))
        || (i.qty !== undefined && !(Number.isInteger(Number(i.qty)) && Number(i.qty) >= 1 && Number(i.qty) <= 100))) {
      return fail(res, 400, 'Invalid item in cart_items');
    }
  }

  // Emergency hours (9 PM - 9 AM) are priced per service. A cart mixes several services with client-side prices, so an
  // emergency visit is booked one service at a time rather than risk charging the wrong amount.
  const emergency = isEmergencyTime(timeWindow);
  if (emergency && cart.length) return fail(res, 400, 'Emergency-hours visits (9 PM to 9 AM) are booked one service at a time. Please book the service directly.');

  let apptDate = new Date().toISOString().split('T')[0];
  if (b.appointment_date !== undefined && b.appointment_date !== null && b.appointment_date !== '') {
    const dateError = validateBookingDate(b.appointment_date);
    if (dateError) return fail(res, 400, dateError);
    apptDate = b.appointment_date;
  }

  let billAmount;
  if (b.total_amount !== undefined && b.total_amount !== null && b.total_amount !== '') {
    if (typeof b.total_amount !== 'number' && typeof b.total_amount !== 'string') return fail(res, 400, 'Invalid total amount');
    billAmount = Number(b.total_amount);
    if (!Number.isFinite(billAmount) || billAmount < 0 || billAmount > 1000000) return fail(res, 400, 'Invalid total amount');
  } else {
    billAmount = cart.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 1), 0) || 599.0;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find or create the user. Only the mobile number identifies a guest; an email is never used to look accounts up.
    let userId;
    const found = await client.query('SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.mobile = $1', [mobile]);
    if (found.rows.length) {
      if (found.rows[0].role !== 'CUSTOMER') {
        await client.query('ROLLBACK');
        return fail(res, 409, 'This phone number cannot be used for a website booking. Please use a different number.');
      }
      userId = found.rows[0].id;
    } else {
      const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const tryInsert = (mail) => client.query(
        `INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id)
         VALUES ($1, $2, $3, $4, 'MOBILE', (SELECT id FROM roles WHERE name = 'CUSTOMER'))
         ON CONFLICT DO NOTHING RETURNING id`,
        [ownerName, mail, mobile, unusableHash]
      );
      let ins = await tryInsert(email || `${mobile.replace(/\D/g, '')}@guest.cadovet.com`);
      // The email belongs to somebody else: keep the booking, drop the email.
      if (!ins.rows.length) ins = await tryInsert(`${mobile.replace(/\D/g, '')}@guest.cadovet.com`);
      if (ins.rows.length) {
        userId = ins.rows[0].id;
      } else {
        // Lost a race with a concurrent booking for the same number: use the account that won.
        const again = await client.query('SELECT u.id, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.mobile = $1', [mobile]);
        if (!again.rows.length || again.rows[0].role !== 'CUSTOMER') {
          await client.query('ROLLBACK');
          return fail(res, 409, 'This phone number cannot be used for a website booking. Please use a different number.');
        }
        userId = again.rows[0].id;
      }
    }

    // 2. Find or create the customer. A saved address is only ever filled in when there is none yet, never replaced.
    await client.query('INSERT INTO customers (user_id, address) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [userId, address || 'Home Visit']);
    const customerId = (await client.query('SELECT id FROM customers WHERE user_id = $1', [userId])).rows[0].id;
    if (address) {
      await client.query("UPDATE customers SET address = $1 WHERE id = $2 AND (address IS NULL OR address = '' OR address = 'Home Visit')", [address, customerId]);
    }

    // 3. Find or create the pet (same name, case-insensitive, per customer).
    const petDisplayName = petNameIn || `${ownerName}'s ${species}`.slice(0, 100);
    let petId = (await client.query('SELECT id FROM pets WHERE customer_id = $1 AND name ILIKE $2 LIMIT 1', [customerId, petDisplayName.replace(/[\\%_]/g, '\\$&')])).rows[0]?.id;
    if (!petId) {
      petId = (await client.query(
        "INSERT INTO pets (customer_id, name, species, breed, gender, age_years, is_aggressive, status, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8) RETURNING id",
        [customerId, petDisplayName, species, breed || 'Domestic', gender ? gender.toUpperCase() : null, ageYears, isAggressive, userId]
      )).rows[0].id;
    } else if (breed !== null || ageYears !== null || gender !== null || b.is_aggressive !== undefined) {
      await client.query(
        `UPDATE pets SET
           breed = COALESCE($1, breed),
           gender = COALESCE($2, gender),
           age_years = COALESCE($3, age_years),
           is_aggressive = $4,
           updated_at = NOW()
         WHERE id = $5`,
        [breed, gender ? gender.toUpperCase() : null, ageYears, isAggressive, petId]
      );
    }

    // 4. Service. No doctor yet: the request goes to the operational head, who assigns one.
    let service = null;
    if (isPositiveInt(b.service_id)) service = (await client.query('SELECT id, price, emergency_price FROM services WHERE id = $1', [b.service_id])).rows[0] || null;
    if (!service && serviceName) {
      service = (await client.query('SELECT id, price, emergency_price FROM services WHERE name ILIKE $1 LIMIT 1', [`%${serviceName.replace(/[\\%_]/g, '\\$&')}%`])).rows[0] || null;
    }
    if (!service) {
      service = (await client.query("SELECT id, price, emergency_price FROM services WHERE name ILIKE '%Home Visit%' OR name ILIKE '%Consultation%' LIMIT 1")).rows[0] || null;
    }
    const serviceId = service?.id || null;
    // In emergency hours the server decides the price (never the client) whenever the service has an emergency price.
    if (emergency && service && service.emergency_price !== null) billAmount = effectivePrice(service, true);

    // 4b. Branch: the one the visitor picked, or the clinic's (first, if there's more than one) when the site
    // hasn't been updated with a branch picker yet.
    let locationId = isPositiveInt(b.location_id) ? Number(b.location_id) : null;
    if (locationId) {
      const validLoc = await client.query("SELECT 1 FROM locations WHERE id = $1 AND status = 'ACTIVE'", [locationId]);
      if (!validLoc.rows.length) locationId = null;
    }
    if (!locationId) {
      locationId = (await client.query("SELECT id FROM locations WHERE status = 'ACTIVE' ORDER BY id LIMIT 1")).rows[0]?.id || null;
    }
    if (!locationId) {
      await client.query('ROLLBACK');
      return fail(res, 400, 'No active branch is configured yet');
    }

    // 5. Appointment.
    const cartText = cart.length ? `Cart Order: ${cart.map((i) => `${i.title || 'Item'} (x${i.qty || 1})`).join(', ')}. Address: ${address || 'Home Visit'}` : `Address: ${address || 'Home Visit'}`;
    const apptNotes = (notesIn || cartText).slice(0, 1000);
    const apptReason = (serviceName || (cart.length && cart[0].title) || 'Doorstep Consultation & Care').slice(0, 255);
    const appt = (await client.query(
      `INSERT INTO appointments (customer_id, pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, status, created_by, source, location_id, is_emergency)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 'PENDING', $8, 'WEBSITE', $9, $10) RETURNING *`,
      [customerId, petId, serviceId, apptDate, timeWindow, apptReason, apptNotes, userId, locationId, emergency]
    )).rows[0];

    // 6. Invoice, with a number that cannot collide even when many people book in the same millisecond.
    let invoiceNumber = null;
    if (billAmount > 0) {
      for (let attempt = 0; attempt < 5 && !invoiceNumber; attempt++) {
        const candidate = `INV-${apptDate.replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const inv = await client.query(
          `INSERT INTO invoices (invoice_number, customer_id, pet_id, appointment_id, subtotal, tax, discount, total_amount, payment_status, payment_method, invoice_date, notes)
           VALUES ($1, $2, $3, $4, $5, 0.00, 0.00, $5, 'PENDING', $6, CURRENT_DATE, $7)
           ON CONFLICT (invoice_number) DO NOTHING RETURNING invoice_number`,
          [candidate, customerId, petId, appt.id, billAmount, paymentMethod.toUpperCase(), `Public Booking: ${apptReason}${emergency ? ' [Emergency hours]' : ''}`]
        );
        if (inv.rows.length) invoiceNumber = inv.rows[0].invoice_number;
      }
      if (!invoiceNumber) throw new Error('Could not allocate an invoice number');
    }

    await client.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId, 'PUBLIC_APPOINTMENT_BOOKED', 'APPOINTMENTS', appt.id, JSON.stringify({ petId, apptDate, billAmount }), req.ip]
    );
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Your appointment and home visit request has been scheduled successfully! Our veterinary coordinator will contact you.',
      data: {
        appointment_id: appt.id,
        appointment_date: apptDate,
        appointment_time: timeWindow,
        pet_name: petDisplayName,
        customer_name: ownerName,
        invoice_number: invoiceNumber,
        total_amount: billAmount,
        is_emergency: emergency,
        status: appt.status,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('publicBookAppointment error:', err);
    res.status(500).json({ success: false, message: 'Failed to process booking', errors: [err.message] });
  } finally {
    client.release();
  }
};

// POST /api/appointments/call-intake  (operational head / admin — a phone call from a pet parent)
//
// One form for the whole call: the pet parent and pet are found by mobile/name or created on the spot (same
// find-or-create as a website guest booking), so nothing has to be pre-registered before the call can be logged.
// The pet parent + pet are saved as their own step, committed before the appointment outcome is even decided —
// so whatever the caller ends up deciding, that record is never lost. `outcome` only decides the appointment's
// own status: BOOKED reserves a real slot (validated the same as any staff booking); DECLINED skips slot
// validation entirely and is saved straight as CANCELLED, purely as a contact/lead record.
exports.callIntake = async (req, res) => {
  const b = req.body || {};
  // The call is logged against whichever branch this desk is currently working from — never chosen by the caller,
  // same as any other desk-scoped action.
  const callerScope = await getStaffScope(req.user.id);
  let locationId = callerScope.role === 'ADMIN' && isPositiveInt(b.location_id) ? Number(b.location_id) : callerScope.activeLocationId;
  if (!locationId) return fail(res, 400, callerScope.role === 'ADMIN' ? 'Select a branch for this call' : 'Choose a branch to work from first (top bar)');

  const ownerName = str(b.owner_name, 100);
  if (!ownerName || ownerName.length < 2) return fail(res, 400, 'Pet parent name is required (2-100 characters)');
  const mobile = canonicalMobile(b.mobile);
  if (!mobile) return fail(res, 400, 'Enter a valid mobile number for the pet parent');
  const email = b.email === undefined || b.email === null || b.email === '' ? null : str(b.email, 255);
  if (b.email && email === null) return fail(res, 400, 'Enter a valid email address');
  if (email !== null && !EMAIL_RE.test(email)) return fail(res, 400, 'Enter a valid email address');
  const address = b.address === undefined || b.address === null || b.address === '' ? null : str(b.address, 300);
  if (b.address && address === null) return fail(res, 400, 'Address is too long');

  const petName = str(b.pet_name, 60);
  if (!petName) return fail(res, 400, 'Pet name is required');
  const species = b.species === undefined || b.species === null || b.species === '' ? 'Dog' : str(b.species, 30);
  if (!species) return fail(res, 400, 'Invalid species');
  const breed = b.breed === undefined || b.breed === null || b.breed === '' ? null : str(b.breed, 60);
  if (b.breed && breed === null) return fail(res, 400, 'Breed is too long');

  if (!b.appointment_date) return fail(res, 400, 'Date is required');
  const dateError = validateBookingDate(b.appointment_date);
  if (dateError) return fail(res, 400, dateError);

  const outcome = b.outcome === 'DECLINED' ? 'DECLINED' : 'BOOKED';
  if (outcome === 'BOOKED' && !isClockTime(b.appointment_time || '')) {
    return fail(res, 400, 'Choose an exact time slot');
  }

  const reason = b.reason === undefined || b.reason === null || b.reason === '' ? null : str(b.reason, 255);
  if (b.reason && reason === null) return fail(res, 400, 'Reason is too long');
  const notes = b.notes === undefined || b.notes === null || b.notes === '' ? null : str(b.notes, 500);
  if (b.notes && notes === null) return fail(res, 400, 'Notes must be at most 500 characters');

  const doctorId = b.doctor_id !== undefined && b.doctor_id !== null && b.doctor_id !== '' ? b.doctor_id : null;
  const assignNow = outcome === 'BOOKED' && doctorId !== null;
  if (assignNow && !(await hasPermission(req.user.role_id, 'APPOINTMENT_ASSIGN'))) {
    return fail(res, 403, 'You are not allowed to assign a doctor');
  }

  let serviceId = null;
  if (b.service_id !== undefined && b.service_id !== null && b.service_id !== '') {
    if (!isPositiveInt(b.service_id)) return fail(res, 400, 'Invalid service');
    const svc = await db.query('SELECT 1 FROM services WHERE id = $1 AND is_active = true', [b.service_id]);
    if (!svc.rows.length) return fail(res, 400, 'Service not found');
    serviceId = Number(b.service_id);
  }

  // Step 1: find-or-create the pet parent and pet. Committed on its own, independent of the appointment outcome.
  let customerId, petId, ownerDisplayName;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    let userId;
    const found = await client.query('SELECT u.id, u.name, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.mobile = $1', [mobile]);
    if (found.rows.length) {
      if (found.rows[0].role !== 'CUSTOMER') {
        await client.query('ROLLBACK');
        return fail(res, 409, 'This mobile number belongs to a staff account, not a pet parent.');
      }
      userId = found.rows[0].id;
      ownerDisplayName = found.rows[0].name;
    } else {
      const unusableHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const tryInsert = (mail) => client.query(
        `INSERT INTO users (name, email, mobile, password_hash, identifier_type, role_id, created_by)
         VALUES ($1, $2, $3, $4, 'MOBILE', (SELECT id FROM roles WHERE name = 'CUSTOMER'), $5)
         ON CONFLICT DO NOTHING RETURNING id, name`,
        [ownerName, mail, mobile, unusableHash, req.user.id]
      );
      let ins = await tryInsert(email || `${mobile.replace(/\D/g, '')}@guest.cadovet.com`);
      // The email belongs to somebody else: keep the booking, drop the email.
      if (!ins.rows.length) ins = await tryInsert(`${mobile.replace(/\D/g, '')}@guest.cadovet.com`);
      if (ins.rows.length) {
        userId = ins.rows[0].id;
        ownerDisplayName = ins.rows[0].name;
      } else {
        // Lost a race with a concurrent call/booking for the same number: use the account that won.
        const again = await client.query('SELECT u.id, u.name, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.mobile = $1', [mobile]);
        if (!again.rows.length || again.rows[0].role !== 'CUSTOMER') {
          await client.query('ROLLBACK');
          return fail(res, 409, 'This mobile number belongs to a staff account, not a pet parent.');
        }
        userId = again.rows[0].id;
        ownerDisplayName = again.rows[0].name;
      }
    }

    // Find or create the customer record. An address given on this call fills a blank one, never overwrites one.
    await client.query('INSERT INTO customers (user_id, address, created_by) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING', [userId, address, req.user.id]);
    customerId = (await client.query('SELECT id FROM customers WHERE user_id = $1', [userId])).rows[0].id;
    if (address) {
      await client.query("UPDATE customers SET address = $1 WHERE id = $2 AND (address IS NULL OR address = '')", [address, customerId]);
    }

    // Find or create the pet (same name, case-insensitive, per customer).
    petId = (await client.query('SELECT id FROM pets WHERE customer_id = $1 AND name ILIKE $2 LIMIT 1', [customerId, petName.replace(/[\\%_]/g, '\\$&')])).rows[0]?.id;
    if (!petId) {
      petId = (await client.query(
        "INSERT INTO pets (customer_id, name, species, breed, status, created_by) VALUES ($1, $2, $3, $4, 'ACTIVE', $5) RETURNING id",
        [customerId, petName, species, breed, req.user.id]
      )).rows[0].id;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('callIntake (pet parent/pet) error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save pet parent / pet details', errors: [err.message] });
  } finally {
    client.release();
  }

  // Step 2: the appointment itself. The pet parent and pet above are already saved either way.
  try {
    if (outcome === 'DECLINED') {
      const inserted = await db.query(
        `INSERT INTO appointments (customer_id, pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, status, created_by, source, location_id)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 'CANCELLED', $8, 'STAFF', $9) RETURNING *`,
        [customerId, petId, serviceId, b.appointment_date, str(b.appointment_time, 60) || 'Not decided', reason, notes, req.user.id, locationId]
      );
      await db.query(
        'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
        [req.user.id, 'CALL_LOGGED_DECLINED', 'APPOINTMENTS', inserted.rows[0].id, JSON.stringify({ customerId, petId, owner: ownerDisplayName }), req.ip]
      );
      return res.status(201).json({
        success: true,
        data: inserted.rows[0],
        message: 'Saved. The pet parent and pet are on file even though they did not book this time.',
      });
    }

    // Doctor-specific bookings are guarded by the unique index; clinic requests by a per-slot lock (see withSlotLock).
    const slotOutcome = await (assignNow ? (d, t, f) => f(db.query.bind(db)) : withSlotLock)(b.appointment_date, b.appointment_time, async (q) => {
      const slot = assignNow
        ? await checkSlot({ doctorId, date: b.appointment_date, time: b.appointment_time, locationId })
        : await checkClinicSlot({ date: b.appointment_date, time: b.appointment_time, locationId, q });
      if (slot.error) return { error: slot.error };
      const inserted = await q(`
        INSERT INTO appointments (customer_id, pet_id, doctor_id, service_id, appointment_date, appointment_time, reason, notes, status, created_by,
                                  source, assigned_by, assigned_at, location_id, is_emergency)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'STAFF', $11, $12, $13, $14)
        RETURNING *
      `, [customerId, petId, assignNow ? Number(doctorId) : null, serviceId, b.appointment_date, slot.time, reason, notes,
          assignNow ? 'CONFIRMED' : 'PENDING', req.user.id, assignNow ? req.user.id : null, assignNow ? new Date() : null, locationId, isEmergencyTime(slot.time)]);
      return { row: inserted.rows[0], time: slot.time };
    });
    if (slotOutcome.error) return fail(res, slotOutcome.error.status, slotOutcome.error.message);

    await db.query(
      'INSERT INTO audit_logs (user_id, action, module, record_id, new_value, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.user.id, 'CALL_LOGGED_BOOKED', 'APPOINTMENTS', slotOutcome.row.id, JSON.stringify({ customerId, petId, owner: ownerDisplayName, doctor_id: assignNow ? Number(doctorId) : null }), req.ip]
    );
    res.status(201).json({
      success: true,
      data: slotOutcome.row,
      message: assignNow ? 'Appointment booked and confirmed' : 'Request added to the queue — assign a doctor next',
    });
  } catch (err) {
    if (isSlotConflict(err)) return fail(res, 409, 'That time slot is no longer available');
    console.error('callIntake (appointment) error:', err);
    res.status(500).json({ success: false, message: 'Pet parent and pet were saved, but the appointment could not be created', errors: [err.message] });
  }
};
