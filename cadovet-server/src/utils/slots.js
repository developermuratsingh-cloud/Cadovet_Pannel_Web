const db = require('./../database');
const { today } = require('./validation');

const SLOT_MINUTES = 60;

// Emergency hours: a visit that starts from 9:00 PM up to (not including) 9:00 AM. See utils/emergency.js.
const EMERGENCY_FROM = 21 * 60;
const EMERGENCY_UNTIL = 9 * 60;
const isEmergencyMinutes = (mins) => Number.isInteger(mins) && (mins >= EMERGENCY_FROM || mins < EMERGENCY_UNTIL);
const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Minutes since midnight, right now, server-local — the same clock `today()` uses. A slot earlier than this on
// today's date has already passed and is never offered or accepted.
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const isPastSlot = (date, mins) => date === today() && mins < nowMinutes();

// 'HH:MM[:SS]' (a database TIME) -> minutes since midnight
const toMinutes = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + (m || 0);
};

// minutes since midnight -> '09:30 AM', the one format stored in appointments.appointment_time
const toSlotLabel = (mins) => {
  const h24 = Math.floor(mins / 60);
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${suffix}`;
};

// Accepts "9:00 am", " 09:00 AM " ... and returns minutes since midnight, or null when it is not a clock time.
const parseSlotTime = (raw) => {
  const m = String(raw ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  if (h === 12) h = 0;
  return (m[3].toUpperCase() === 'PM' ? h + 12 : h) * 60 + min;
};

const isPositiveInt = (v) => /^[0-9]{1,9}$/.test(String(v)) && Number(v) > 0;

// Validates a doctor/date/time triple the same way for booking, rescheduling and staff edits. On success returns the
// canonical time label to store; on failure { error: { status, message } }.
//   400 malformed / not a real slot for that doctor   409 slot already taken
async function checkSlot({ doctorId, date, time, excludeId = null, locationId = null }) {
  const mins = parseSlotTime(time);
  if (mins === null) return { error: { status: 400, message: 'Time must look like "09:30 AM"' } };
  if (isPastSlot(date, mins)) return { error: { status: 400, message: 'That time has already passed today' } };
  const label = toSlotLabel(mins);
  if (doctorId === null || doctorId === undefined || doctorId === '') return { time: label };

  if (!isPositiveInt(doctorId)) return { error: { status: 400, message: 'Doctor not found' } };
  const docRes = await db.query("SELECT id, available_days, available_from, available_to FROM doctors WHERE id = $1 AND status = 'ACTIVE'", [doctorId]);
  const doc = docRes.rows[0];
  if (!doc) return { error: { status: 400, message: 'Doctor not found or not available' } };

  // The visit's branch and the doctor's roster must agree — a doctor can't be booked for a branch they don't work at.
  if (locationId) {
    const rostered = await db.query('SELECT 1 FROM user_locations ul JOIN doctors d ON d.user_id = ul.user_id WHERE d.id = $1 AND ul.location_id = $2', [doc.id, locationId]);
    if (!rostered.rows.length) return { error: { status: 400, message: 'That doctor is not rostered at this branch' } };
  }

  // An emergency visit (9 PM - 9 AM) is covered by whichever doctor the operational head puts on it, so it is not held to
  // that doctor's usual working days and hours. Everything else about the slot (branch roster, double-booking) still applies.
  if (!isEmergencyMinutes(mins)) {
    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const days = String(doc.available_days || '').split(',').map((d) => d.trim());
    if (!days.includes(weekday)) return { error: { status: 400, message: 'The doctor does not work on that day' } };

    const from = toMinutes(doc.available_from);
    const to = toMinutes(doc.available_to);
    if (mins < from || mins + SLOT_MINUTES > to || (mins - from) % SLOT_MINUTES !== 0) {
      return { error: { status: 400, message: 'That time is outside the doctor\'s working hours' } };
    }
  }

  const taken = await db.query(
    `SELECT 1 FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2 AND UPPER(TRIM(appointment_time)) = $3
       AND status = ANY($4) AND ($5::int IS NULL OR id <> $5) LIMIT 1`,
    [doc.id, date, label, ACTIVE_STATUSES, excludeId]
  );
  if (taken.rows.length) return { error: { status: 409, message: 'That time slot is no longer available' } };
  return { time: label };
}


// --- Clinic-level slots (what a customer sees when they ask for an appointment) ----------------------------------------
// The clinic runs 24/7 (emergency visits and home visits aren't limited to any doctor's own day shift), so every
// half-hour slot across the full day is offered here — this is "which slot could the clinic take on", not "which
// doctor is rostered right now"; a specific doctor's own shift only matters once checkSlot books *that* doctor.
// The cap per slot is how many active doctors AT THAT BRANCH could end up covering it — every branch has its own
// capacity and its own demand, so a busy branch never blocks booking at a quiet one.
async function clinicCapacity(date, locationId, q = db.query.bind(db)) {
  const activeRes = locationId
    ? await q(
        `SELECT COUNT(DISTINCT doc.id)::int AS n FROM doctors doc
         JOIN user_locations ul ON ul.user_id = doc.user_id AND ul.location_id = $1
         WHERE doc.status = 'ACTIVE'`,
        [locationId]
      )
    : await q("SELECT COUNT(*)::int AS n FROM doctors WHERE status = 'ACTIVE'");
  const perSlot = activeRes.rows[0]?.n || 0;
  const capacity = new Map(); // minutes since midnight -> how many requests the clinic can take at that time
  for (let t = 0; t < 24 * 60; t += SLOT_MINUTES) capacity.set(t, perSlot);
  return capacity;
}

async function clinicSlots(date, locationId) {
  const capacity = await clinicCapacity(date, locationId);
  const demandRes = await db.query(
    `SELECT UPPER(TRIM(appointment_time)) AS t, COUNT(*)::int AS n FROM appointments
     WHERE appointment_date = $1 AND status = ANY($2) ${locationId ? 'AND location_id = $3' : ''} GROUP BY 1`,
    locationId ? [date, ACTIVE_STATUSES, locationId] : [date, ACTIVE_STATUSES]
  );
  const demand = new Map(demandRes.rows.map((r) => [r.t, r.n]));
  return [...capacity.keys()]
    .filter((mins) => !isPastSlot(date, mins))
    .sort((a, b) => a - b)
    .map((mins) => {
      const time = toSlotLabel(mins);
      return { time, available: (demand.get(time) || 0) < capacity.get(mins), emergency: isEmergencyMinutes(mins) };
    });
}

// Same contract as checkSlot, without a doctor: 400 when nobody works then, 409 when the clinic is fully booked.
async function checkClinicSlot({ date, time, locationId, excludeId = null, q = db.query.bind(db) }) {
  const mins = parseSlotTime(time);
  if (mins === null) return { error: { status: 400, message: 'Time must look like "09:30 AM"' } };
  if (isPastSlot(date, mins)) return { error: { status: 400, message: 'That time has already passed today' } };
  const label = toSlotLabel(mins);
  const cap = (await clinicCapacity(date, locationId, q)).get(mins) || 0;
  if (!cap) return { error: { status: 400, message: 'No doctor is available at that time' } };
  const demand = await q(
    `SELECT COUNT(*)::int AS n FROM appointments WHERE appointment_date = $1 AND UPPER(TRIM(appointment_time)) = $2 AND status = ANY($3) AND ($4::int IS NULL OR id <> $4) ${locationId ? 'AND location_id = $5' : ''}`,
    locationId ? [date, label, ACTIVE_STATUSES, excludeId, locationId] : [date, label, ACTIVE_STATUSES, excludeId]
  );
  if (demand.rows[0].n >= cap) return { error: { status: 409, message: 'That time slot is no longer available' } };
  return { time: label };
}

const isClockTime = (raw) => parseSlotTime(raw) !== null;

// Serialises "check the clinic has room, then write" for one date+time, so simultaneous requests cannot overbook it.
// Everything inside runs on ONE connection in ONE transaction and receives its query function `q`; the transaction-scoped
// advisory lock is released on COMMIT/ROLLBACK. (Holding a lock on a separate connection while queries use the pool
// would exhaust the pool under load.)
async function withSlotLock(date, time, fn) {
  const mins = parseSlotTime(time);
  if (mins === null) return fn(db.query.bind(db)); // malformed: fn's own validation rejects it
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`slot:${date}:${toSlotLabel(mins)}`]);
    const out = await fn(client.query.bind(client));
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Under a race two requests can both pass checkSlot; the unique index (migrate_hardening.sql) lets only one INSERT/UPDATE win.
const isSlotConflict = (err) => err && err.code === '23505' && /uq_appointments_active_slot/.test(err.constraint || err.message || '');

module.exports = { SLOT_MINUTES, EMERGENCY_FROM, EMERGENCY_UNTIL, isEmergencyMinutes, ACTIVE_STATUSES, WEEKDAYS, toMinutes, toSlotLabel, parseSlotTime, isPositiveInt, checkSlot, isSlotConflict, clinicSlots, checkClinicSlot, isClockTime, withSlotLock, isPastSlot };
