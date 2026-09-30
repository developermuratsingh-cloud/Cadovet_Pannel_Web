// The clinic workflow:
//   1. An appointment requested through the APP or the WEBSITE (or booked by staff) lands with the OPERATIONAL HEAD, who
//      assigns it to a DOCTOR. A doctor sees an appointment only after it is assigned to them, never before.
//   2. A customer who phones the clinic is registered by the operational head in the admin panel and then signs in
//      directly with their mobile number.
//   3. Customers sign in with mobile number + OTP; staff (admin, operational head, doctors, desk staff) with email + password.
process.env.PUBLIC_BOOKING_RATE_LIMIT = '1000';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const h = require('./helpers');

const { api } = h;
let admin, ops, drA, drB, inventory; // drA = doctor 1 (doctor@), drB = doctor 2 (meera@)
let n = 0;
const monday = () => h.futureDate(200 + 7 * ++n, 1); // a fresh Monday: doctor 1 works 09:00-18:00, doctor 2 works 10:00-19:00
const ids = async (email) => (await h.db.query('SELECT u.id AS user_id, d.id AS doctor_id FROM users u LEFT JOIN doctors d ON d.user_id = u.id WHERE u.email = $1', [email])).rows[0];
const assign = (token, id, body) => api.patch(`/api/appointments/${id}/assign`, body, { token });
const listIds = async (token, q = '') => (await api.get(`/api/appointments?limit=200${q}`, { token })).body.data.map((a) => a.id);

before(async () => {
  await h.start();
  [admin, ops, drA, drB, inventory] = await Promise.all(
    ['admin@cadovet.com', 'ops@cadovet.com', 'doctor@cadovet.com', 'meera@cadovet.com', 'inventory@cadovet.com'].map(async (e, i) => { await new Promise((r) => setTimeout(r, i * 30)); return h.loginStaff(e); }));
});
after(h.stop);

describe('Roles: who is who', () => {
  it('the seeded staff hold the right roles', async () => {
    const roleOf = async (token) => (await api.get('/api/auth/me', { token })).body.data.role_name;
    assert.equal(await roleOf(admin), 'ADMIN');
    assert.equal(await roleOf(ops), 'OPERATIONAL_HEAD');
    assert.equal(await roleOf(drA), 'DOCTOR');
    assert.equal(await roleOf(drB), 'DOCTOR');
    assert.equal(await roleOf(inventory), 'INVENTORY');
  });
  it('only the operational head and admin can assign; doctors and desk staff cannot', async () => {
    const perms = async (token) => (await api.get('/api/auth/me', { token })).body.data.permissions;
    assert.ok((await perms(ops)).includes('APPOINTMENT_ASSIGN'));
    assert.ok((await perms(admin)).includes('APPOINTMENT_ASSIGN'));
    assert.ok(!(await perms(drA)).includes('APPOINTMENT_ASSIGN'));
    assert.ok(!(await perms(inventory)).includes('APPOINTMENT_ASSIGN'));
  });
  it('the operational head registers customers and manages billing but has no clinical or user-admin rights', async () => {
    const p = (await api.get('/api/auth/me', { token: ops })).body.data.permissions;
    for (const x of ['CUSTOMER_CREATE', 'APPOINTMENT_CREATE', 'INVOICE_MANAGE', 'PET_CREATE']) assert.ok(p.includes(x), x);
    for (const x of ['MEDICAL_RECORD_MANAGE', 'MEDICAL_RECORD_VIEW', 'USER_CREATE', 'ROLE_MANAGE', 'DOCTOR_CREATE']) assert.ok(!p.includes(x), x);
  });
  it('a doctor has clinical rights but cannot register customers, bill, or manage staff', async () => {
    const p = (await api.get('/api/auth/me', { token: drA })).body.data.permissions;
    for (const x of ['MEDICAL_RECORD_MANAGE', 'MEDICAL_RECORD_VIEW', 'APPOINTMENT_VIEW']) assert.ok(p.includes(x), x);
    for (const x of ['CUSTOMER_CREATE', 'APPOINTMENT_CREATE', 'APPOINTMENT_CANCEL', 'INVOICE_VIEW', 'INVOICE_MANAGE', 'USER_CREATE']) assert.ok(!p.includes(x), x);
    // The doctor panel has no customer directory or staff/doctor directory - not even read-only - so neither permission is granted.
    for (const x of ['CUSTOMER_VIEW', 'DOCTOR_VIEW']) assert.ok(!p.includes(x), x);
  });
  it('desk staff (inventory/pharmacy) no longer see appointments, customers, pets or records', async () => {
    for (const p of ['/api/appointments', '/api/customers', '/api/pets', '/api/medical-records', '/api/invoices']) {
      assert.equal((await api.get(p, { token: inventory })).status, 403, p);
    }
  });
});

describe('Requests land with the operational head', () => {
  it('an app request is PENDING and unassigned, and is in the operational head\'s queue', async () => {
    const { appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '10:00 AM' });
    assert.equal(appointment.status, 'PENDING');
    assert.equal(appointment.doctor_id, null);
    assert.ok((await listIds(ops, '&assigned=false')).includes(appointment.id));
    assert.ok((await listIds(admin, '&assigned=false')).includes(appointment.id));
  });
  it('a website booking (no login) lands in the same queue, marked WEBSITE', async () => {
    const r = await api.post('/api/appointments/public', { owner_name: 'Queue Guest', phone: h.uniqueMobile(), pet_name: 'Rex', species: 'Dog', service_id: 1, appointment_date: h.futureDate(9), appointment_time: '10:00 AM to 12:00 PM', address: '1 Road' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.status, 'PENDING');
    const a = (await api.get(`/api/appointments/${r.body.data.appointment_id}`, { token: ops })).body.data;
    assert.equal(a.doctor_id, null);
    assert.equal(a.source, 'WEBSITE');
    assert.ok((await listIds(ops, '&assigned=false')).includes(a.id));
  });
  it('the queue can be filtered by where the request came from', async () => {
    const app = await h.pendingRequest({ appointment_date: monday(), appointment_time: '10:30 AM' });
    const list = (await api.get('/api/appointments?assigned=false&source=APP&limit=200', { token: ops })).body.data;
    assert.ok(list.some((a) => a.id === app.appointment.id));
    assert.ok(list.every((a) => a.source === 'APP' && a.doctor_id === null));
  });
  it('the queue is oldest-date first so nothing urgent is buried', async () => {
    const list = (await api.get('/api/appointments?assigned=false&limit=200', { token: ops })).body.data;
    const dates = list.map((a) => String(a.appointment_date));
    assert.deepEqual(dates, [...dates].sort());
  });
});

describe('Assigning a doctor', () => {
  it('confirms the appointment, records who assigned it and when, audits it, and the customer sees the doctor', async () => {
    const { customer, appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    const doc = await ids('doctor@cadovet.com'); const opsUser = await ids('ops@cadovet.com');
    const r = await assign(ops, appointment.id, { doctor_id: doc.doctor_id });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.status, 'CONFIRMED');
    assert.equal(r.body.data.doctor_id, doc.doctor_id);
    assert.equal(r.body.data.assigned_by, opsUser.user_id);
    assert.ok(r.body.data.assigned_at);
    assert.equal((await h.db.query("SELECT 1 FROM audit_logs WHERE action = 'APPOINTMENT_ASSIGNED' AND record_id = $1", [appointment.id])).rowCount, 1);
    const seen = (await api.get(`/api/appointments/${appointment.id}`, { token: customer.token })).body.data;
    assert.equal(seen.status, 'CONFIRMED');
    assert.ok(seen.doctor_name);
    assert.ok(!(await listIds(ops, '&assigned=false')).includes(appointment.id), 'it left the queue');
  });
  it('the operational head can change the time while assigning', async () => {
    const { appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    const doc = await ids('doctor@cadovet.com');
    const date = monday();
    const r = await assign(ops, appointment.id, { doctor_id: doc.doctor_id, appointment_date: date, appointment_time: '3:30 pm' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.data.appointment_time, '03:30 PM');
    assert.equal(String(r.body.data.appointment_date), date);
  });
  it('a website doorstep window needs an exact time before a doctor can take it', async () => {
    const guest = await api.post('/api/appointments/public', { owner_name: 'Window Guest', phone: h.uniqueMobile(), pet_name: 'Bo', service_id: 1, appointment_date: monday(), appointment_time: '10:00 AM to 12:00 PM' });
    const id = guest.body.data.appointment_id;
    const doc = await ids('doctor@cadovet.com');
    assert.equal((await assign(ops, id, { doctor_id: doc.doctor_id })).status, 400);
    assert.equal((await assign(ops, id, { doctor_id: doc.doctor_id, appointment_time: '10:00 AM' })).status, 200);
  });
  it('validates: doctor required and real, working day and hours, past dates', async () => {
    const { appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    const id = appointment.id; const doc = await ids('doctor@cadovet.com');
    assert.equal((await assign(ops, id, {})).status, 400);
    assert.equal((await assign(ops, id, { doctor_id: 'abc' })).status, 400);
    assert.equal((await assign(ops, id, { doctor_id: 999999 })).status, 400);
    assert.equal((await assign(ops, id, { doctor_id: doc.doctor_id, appointment_date: h.futureDate(300, 0) })).status, 400, 'Sunday');
    assert.equal((await assign(ops, id, { doctor_id: doc.doctor_id, appointment_time: '07:00 PM' })).status, 400, 'outside hours');
    assert.equal((await assign(ops, id, { doctor_id: doc.doctor_id, appointment_date: '2020-01-01' })).status, 400, 'past');
    assert.equal((await assign(ops, 99999999, { doctor_id: doc.doctor_id })).status, 404);
  });
  it('an inactive doctor cannot be assigned', async () => {
    const { appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    await h.db.query("UPDATE doctors SET status = 'INACTIVE' WHERE id = 2");
    const r = await assign(ops, appointment.id, { doctor_id: 2 });
    await h.db.query("UPDATE doctors SET status = 'ACTIVE' WHERE id = 2");
    assert.equal(r.status, 400);
  });
  it('a doctor\'s slot cannot be given twice (409), but another doctor can take the same time', async () => {
    const date = monday();
    const a = await h.pendingRequest({ appointment_date: date, appointment_time: '01:00 PM' });
    const b = await h.pendingRequest({ appointment_date: date, appointment_time: '01:00 PM' });
    const d1 = await ids('doctor@cadovet.com'); const d2 = await ids('meera@cadovet.com');
    assert.equal((await assign(ops, a.appointment.id, { doctor_id: d1.doctor_id })).status, 200);
    assert.equal((await assign(ops, b.appointment.id, { doctor_id: d1.doctor_id })).status, 409);
    assert.equal((await assign(ops, b.appointment.id, { doctor_id: d2.doctor_id })).status, 200);
  });
  it('races: two requests assigned to one doctor at one time simultaneously — exactly one wins', async () => {
    const date = monday();
    const [a, b] = await Promise.all([h.pendingRequest({ appointment_date: date, appointment_time: '02:00 PM' }), h.pendingRequest({ appointment_date: date, appointment_time: '02:00 PM' })]);
    const d1 = await ids('doctor@cadovet.com');
    const rs = await Promise.all([assign(ops, a.appointment.id, { doctor_id: d1.doctor_id }), assign(admin, b.appointment.id, { doctor_id: d1.doctor_id })]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
  });
  it('only PENDING/CONFIRMED appointments can be assigned', async () => {
    const { customer, appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    await api.patch(`/api/appointments/${appointment.id}/cancel`, {}, { token: customer.token });
    const d1 = await ids('doctor@cadovet.com');
    assert.equal((await assign(ops, appointment.id, { doctor_id: d1.doctor_id })).status, 400);
  });
  it('nobody but the operational head and admin can assign', async () => {
    const { customer, appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    const d1 = await ids('doctor@cadovet.com');
    for (const t of [drA, drB, inventory, customer.token]) assert.equal((await assign(t, appointment.id, { doctor_id: d1.doctor_id })).status, 403);
    assert.equal((await api.patch(`/api/appointments/${appointment.id}/assign`, { doctor_id: d1.doctor_id })).status, 401);
    assert.equal((await assign(admin, appointment.id, { doctor_id: d1.doctor_id })).status, 200);
  });
  it('staff cannot confirm or complete an appointment that has no doctor', async () => {
    const { appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    assert.equal((await api.patch(`/api/appointments/${appointment.id}/status`, { status: 'CONFIRMED' }, { token: ops })).status, 400);
    assert.equal((await api.patch(`/api/appointments/${appointment.id}/status`, { status: 'COMPLETED' }, { token: admin })).status, 400);
    assert.equal((await api.put(`/api/appointments/${appointment.id}`, { status: 'CONFIRMED' }, { token: admin })).status, 400);
  });
  it('the database itself refuses a confirmed appointment without a doctor', async () => {
    const { appointment } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    await assert.rejects(h.db.query("UPDATE appointments SET status = 'CONFIRMED' WHERE id = $1", [appointment.id]), /appointments_doctor_when_confirmed/);
  });
});

describe('A doctor sees only what is assigned to them', () => {
  let d1, d2, unassigned, toA, toB;
  before(async () => {
    d1 = await ids('doctor@cadovet.com'); d2 = await ids('meera@cadovet.com');
    unassigned = (await h.pendingRequest({ appointment_date: monday(), appointment_time: '09:00 AM' }));
    toA = (await h.pendingRequest({ appointment_date: monday(), appointment_time: '09:30 AM' }));
    toB = (await h.pendingRequest({ appointment_date: monday(), appointment_time: '10:00 AM' }));
    await assign(ops, toA.appointment.id, { doctor_id: d1.doctor_id });
    await assign(ops, toB.appointment.id, { doctor_id: d2.doctor_id, appointment_time: '10:00 AM' });
  });

  it('the list holds only the doctor\'s own appointments: not the unassigned queue, not another doctor\'s', async () => {
    const a = await listIds(drA); const b = await listIds(drB);
    assert.ok(a.includes(toA.appointment.id));
    assert.ok(!a.includes(unassigned.appointment.id), 'unassigned request leaked to a doctor');
    assert.ok(!a.includes(toB.appointment.id), 'another doctor\'s appointment leaked');
    assert.ok(b.includes(toB.appointment.id) && !b.includes(toA.appointment.id) && !b.includes(unassigned.appointment.id));
    const all = (await api.get('/api/appointments?limit=200', { token: drA })).body.data;
    assert.ok(all.every((x) => x.doctor_id === d1.doctor_id));
  });
  it('filters cannot widen what a doctor sees', async () => {
    for (const q of [`&doctor_id=${d2.doctor_id}`, '&assigned=false', '&source=WEBSITE', `&customer_id=${toB.appointment.customer_id}`]) {
      const ids = await listIds(drA, q);
      assert.ok(!ids.includes(toB.appointment.id) && !ids.includes(unassigned.appointment.id), `q=${q}`);
    }
  });
  it('opening another appointment by id is 404 (own is 200)', async () => {
    assert.equal((await api.get(`/api/appointments/${toA.appointment.id}`, { token: drA })).status, 200);
    assert.equal((await api.get(`/api/appointments/${toB.appointment.id}`, { token: drA })).status, 404);
    assert.equal((await api.get(`/api/appointments/${unassigned.appointment.id}`, { token: drA })).status, 404);
  });
  it('a request only becomes visible to a doctor once assigned — and moves with a re-assignment', async () => {
    const r = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    const id = r.appointment.id;
    assert.equal((await api.get(`/api/appointments/${id}`, { token: drA })).status, 404);
    await assign(ops, id, { doctor_id: d1.doctor_id });
    assert.equal((await api.get(`/api/appointments/${id}`, { token: drA })).status, 200);
    assert.equal((await api.get(`/api/appointments/${id}`, { token: drB })).status, 404);
    await assign(ops, id, { doctor_id: d2.doctor_id });
    assert.equal((await api.get(`/api/appointments/${id}`, { token: drA })).status, 404, 'the first doctor loses sight of it');
    assert.equal((await api.get(`/api/appointments/${id}`, { token: drB })).status, 200);
  });
  it('a customer moving an assigned visit sends it back to the queue, and the doctor loses it', async () => {
    const r = await h.pendingRequest({ appointment_date: monday(), appointment_time: '11:00 AM' });
    await assign(ops, r.appointment.id, { doctor_id: d1.doctor_id });
    const mv = await api.patch(`/api/appointments/${r.appointment.id}/reschedule`, { appointment_date: monday(), appointment_time: '12:00 PM' }, { token: r.customer.token });
    assert.equal(mv.status, 200, JSON.stringify(mv.body));
    assert.equal(mv.body.data.status, 'PENDING');
    assert.equal(mv.body.data.doctor_id, null);
    assert.equal((await api.get(`/api/appointments/${r.appointment.id}`, { token: drA })).status, 404);
    assert.ok((await listIds(ops, '&assigned=false')).includes(r.appointment.id));
  });
  it('a doctor cannot create, assign, edit or cancel appointments', async () => {
    const doc = d1.doctor_id;
    assert.equal((await api.post('/api/appointments', { pet_id: 1, customer_id: 1, doctor_id: doc, appointment_date: monday(), appointment_time: '11:00 AM' }, { token: drA })).status, 403);
    assert.equal((await assign(drA, toA.appointment.id, { doctor_id: doc })).status, 403);
    assert.equal((await api.put(`/api/appointments/${toA.appointment.id}`, { reason: 'x' }, { token: drA })).status, 403);
    assert.equal((await api.patch(`/api/appointments/${toA.appointment.id}/cancel`, {}, { token: drA })).status, 403);
    assert.equal((await api.patch(`/api/appointments/${toA.appointment.id}/reschedule`, { appointment_date: monday(), appointment_time: '11:00 AM' }, { token: drA })).status, 403);
  });
  it('a doctor can only mark their OWN confirmed appointments completed', async () => {
    assert.equal((await api.patch(`/api/appointments/${toB.appointment.id}/status`, { status: 'COMPLETED' }, { token: drA })).status, 404, 'not theirs');
    assert.equal((await api.patch(`/api/appointments/${unassigned.appointment.id}/status`, { status: 'COMPLETED' }, { token: drA })).status, 404);
    assert.equal((await api.patch(`/api/appointments/${toA.appointment.id}/status`, { status: 'CANCELLED' }, { token: drA })).status, 403);
    assert.equal((await api.patch(`/api/appointments/${toA.appointment.id}/status`, { status: 'PENDING' }, { token: drA })).status, 403);
    const r = await api.patch(`/api/appointments/${toA.appointment.id}/status`, { status: 'COMPLETED' }, { token: drA });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const seen = (await api.get(`/api/appointments/${toA.appointment.id}`, { token: toA.customer.token })).body.data;
    assert.equal(seen.status, 'COMPLETED', 'the customer sees it finished');
    assert.equal((await api.get(`/api/appointments/${toA.appointment.id}`, { token: ops })).body.data.status, 'COMPLETED', 'and so does the operational head');
    assert.equal((await api.patch(`/api/appointments/${toA.appointment.id}/status`, { status: 'COMPLETED' }, { token: drA })).status, 400, 'not twice');
  });
  it('a doctor sees only their own patients\' pets, and has no customer or staff directory at all', async () => {
    const pets = (await api.get('/api/pets?limit=200', { token: drB })).body.data.map((p) => p.id);
    assert.ok(pets.includes(toB.pet.id));
    assert.ok(!pets.includes(toA.pet.id) && !pets.includes(unassigned.pet.id));
    assert.equal((await api.get(`/api/pets/${toB.pet.id}`, { token: drB })).status, 200);
    assert.equal((await api.get(`/api/pets/${toA.pet.id}`, { token: drB })).status, 404);
    assert.equal((await api.get(`/api/pets/${unassigned.pet.id}`, { token: drB })).status, 404);
    // The doctor panel has no Customers directory and no Doctors/Staff directory: a doctor works only from their own
    // assigned appointments (which already carry the patient's and owner's details), never by browsing either list.
    assert.equal((await api.get('/api/customers?limit=200', { token: drB })).status, 403);
    assert.equal((await api.get(`/api/customers/${toB.customer.userId}`, { token: drB })).status, 403);
    assert.equal((await api.get('/api/doctors', { token: drB })).status, 403);
    assert.equal((await api.get(`/api/doctors/${d1.doctor_id}`, { token: drB })).status, 403, 'not even their own doctor profile, by design - there is no doctor directory feature for them');
  });
  it('a doctor never sees a pet, appointment or customer from an appointment that was never actually assigned to them (legacy doctor_id, no assignment)', async () => {
    const { customer, pet } = await h.pendingRequest({ appointment_date: monday(), appointment_time: '05:30 PM' });
    // Simulate data from before the assignment workflow existed: doctor_id set directly, no assigned_by/assigned_at.
    const legacy = await h.db.query(
      "UPDATE appointments SET doctor_id = $1, status = 'CONFIRMED' WHERE customer_id = (SELECT id FROM customers WHERE user_id = $2) RETURNING id",
      [d1.doctor_id, customer.userId]
    );
    const apptId = legacy.rows[0].id;
    assert.equal((await api.get(`/api/appointments/${apptId}`, { token: drA })).status, 404, 'a doctor_id alone is not an assignment');
    assert.ok(!(await api.get('/api/appointments?limit=200', { token: drA })).body.data.some((a) => a.id === apptId));
    assert.equal((await api.patch(`/api/appointments/${apptId}/status`, { status: 'COMPLETED' }, { token: drA })).status, 404);
    assert.ok(!(await api.get('/api/pets?limit=200', { token: drA })).body.data.some((p) => p.id === pet.id));
    assert.equal((await api.get(`/api/pets/${pet.id}`, { token: drA })).status, 404);
  });
  it('a doctor writes clinical records only for their own patients, under their own name', async () => {
    const body = (pet) => ({ pet_id: pet.id, doctor_id: d1.doctor_id, diagnosis: 'Checked', symptoms: 'None', visit_date: h.futureDate(0) });
    assert.equal((await api.post('/api/medical-records', body(toB.pet), { token: drA })).status, 403, 'someone else\'s patient');
    assert.equal((await api.post('/api/medical-records', body(unassigned.pet), { token: drA })).status, 403, 'not yet assigned');
    const ok = await api.post('/api/medical-records', body(toA.pet), { token: drA });
    assert.ok([200, 201].includes(ok.status), JSON.stringify(ok.body));
    // even when a doctor names someone else, the record is filed under themselves
    const forged = await api.post('/api/medical-records', { ...body(toB.pet), doctor_id: d1.doctor_id }, { token: drB });
    assert.ok([200, 201].includes(forged.status));
    const stored = (await h.db.query('SELECT doctor_id FROM medical_records WHERE id = $1', [forged.body.data.id])).rows[0];
    assert.equal(stored.doctor_id, d2.doctor_id);
  });
  it('a doctor reads records of their own patients only; the customer can read theirs', async () => {
    const recA = (await api.get('/api/medical-records?limit=200', { token: drA })).body.data;
    const recB = (await api.get('/api/medical-records?limit=200', { token: drB })).body.data;
    assert.ok(recA.some((r) => r.pet_id === toA.pet.id) && !recA.some((r) => r.pet_id === toB.pet.id));
    assert.ok(recB.some((r) => r.pet_id === toB.pet.id) && !recB.some((r) => r.pet_id === toA.pet.id));
    const one = recB.find((r) => r.pet_id === toB.pet.id);
    assert.equal((await api.get(`/api/medical-records/${one.id}`, { token: drA })).status, 404);
    assert.equal((await api.get(`/api/medical-records/${one.id}`, { token: drB })).status, 200);
    assert.equal((await api.get(`/api/medical-records/${one.id}`, { token: toB.customer.token })).status, 200);
  });
  it('the operational head has no access to clinical records; a doctor has none to billing or staff admin', async () => {
    assert.equal((await api.get('/api/medical-records', { token: ops })).status, 403);
    for (const p of ['/api/invoices', '/api/users', '/api/audit-logs', '/api/roles']) assert.equal((await api.get(p, { token: drA })).status, 403, p);
  });
  it('a doctor account with no doctor profile sees nothing at all (never "everything")', async () => {
    const email = `ghost${Date.now()}@cadovet.test`;
    const made = await api.post('/api/doctors', { name: 'Ghost Doctor', email, password: 'Temp1234', specialization: 'Testing', location_ids: [await h.firstActiveLocationId()] }, { token: admin });
    assert.equal(made.status, 201, JSON.stringify(made.body));
    const gid = made.body.data.id;
    const token = await h.loginStaff(email, 'Temp1234');
    await h.db.query('DELETE FROM doctors WHERE id = $1', [gid]); // the profile disappears, the DOCTOR user remains
    assert.equal((await api.get('/api/appointments?limit=200', { token })).body.data.length, 0);
    assert.equal((await api.get('/api/pets', { token })).body.data.length, 0);
    assert.equal((await api.get('/api/customers', { token })).status, 403, 'no customer directory at all, profile or not');
  });
});

describe('Call-in customers: registered by the operational head, then sign in by mobile', () => {
  it('the operational head registers a caller with just a name and mobile number; no password exists', async () => {
    const mobile = h.uniqueMobile();
    const r = await api.post('/api/customers', { name: 'Phone Caller', mobile, address: '9 Clinic Lane', city: 'Pune' }, { token: ops });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const row = (await h.db.query('SELECT u.mobile, u.email, u.identifier_type, u.created_by, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1', [r.body.data.id])).rows[0];
    assert.deepEqual([row.mobile, row.email, row.identifier_type, row.role], [mobile, null, 'MOBILE', 'CUSTOMER']);
    assert.equal(row.created_by, (await ids('ops@cadovet.com')).user_id);
    for (const pw of ['admin123', 'password', mobile, 'customer123']) assert.equal((await api.post('/api/auth/login', { identifier: mobile, password: pw })).status, 400, 'customers cannot use the password login');
  });
  it('the caller can then sign in directly with that mobile number and an OTP', async () => {
    const mobile = h.uniqueMobile();
    await api.post('/api/customers', { name: 'Direct Login', mobile, city: 'Kochi' }, { token: ops });
    const login = await h.loginWithOtp(mobile);
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const me = (await api.get('/api/auth/me', { token: login.body.data.token })).body.data;
    assert.deepEqual([me.name, me.role_name, me.city], ['Direct Login', 'CUSTOMER', 'Kochi']);
  });
  it('a mobile number is required (email alone is not enough); email is optional; formats are normalised', async () => {
    assert.equal((await api.post('/api/customers', { name: 'No Mobile', email: 'nomobile@example.com' }, { token: ops })).status, 400);
    assert.equal((await api.post('/api/customers', { name: 'Bad Mobile', mobile: '12345' }, { token: ops })).status, 400);
    assert.equal((await api.post('/api/customers', { mobile: h.uniqueMobile() }, { token: ops })).status, 400, 'name required');
    assert.equal((await api.post('/api/customers', { name: 'Bad Email', mobile: h.uniqueMobile(), email: 'nope' }, { token: ops })).status, 400);
    const m = h.uniqueMobile();
    const ok = await api.post('/api/customers', { name: 'Formatted', mobile: `+91 ${m.slice(0, 5)}-${m.slice(5)}`, email: `fmt${Date.now()}@example.com` }, { token: ops });
    assert.equal(ok.status, 201);
    assert.equal((await h.loginWithOtp(m)).status, 200);
  });
  it('the same number cannot be registered twice', async () => {
    const mobile = h.uniqueMobile();
    assert.equal((await api.post('/api/customers', { name: 'First', mobile }, { token: ops })).status, 201);
    assert.equal((await api.post('/api/customers', { name: 'Second', mobile }, { token: ops })).status, 409);
    assert.equal((await api.post('/api/auth/otp/send', { mobile, purpose: 'signup' })).status, 409);
  });
  it('only staff who may create customers can (doctors and customers cannot)', async () => {
    assert.equal((await api.post('/api/customers', { name: 'Nope', mobile: h.uniqueMobile() }, { token: drA })).status, 403);
    const c = await h.signupCustomer();
    assert.equal((await api.post('/api/customers', { name: 'Nope', mobile: h.uniqueMobile() }, { token: c.token })).status, 403);
    assert.equal((await api.post('/api/customers', { name: 'Ok', mobile: h.uniqueMobile() }, { token: admin })).status, 201);
  });
  it('the whole phone-call journey: register -> add pet -> book -> assign -> doctor sees -> customer signs in and sees it', async () => {
    const mobile = h.uniqueMobile();
    const created = await api.post('/api/customers', { name: 'Journey Caller', mobile }, { token: ops });
    const customerId = created.body.data.customer_id;
    const pet = await api.post('/api/pets', { name: 'Tiger', species: 'Cat', customer_id: customerId }, { token: ops });
    assert.equal(pet.status, 201, JSON.stringify(pet.body));
    const date = monday();
    const booking = await api.post('/api/appointments', { customer_id: customerId, pet_id: pet.body.data.id, service_id: 1, appointment_date: date, appointment_time: '11:00 AM', reason: 'Phoned in' }, { token: ops });
    assert.equal(booking.status, 201, JSON.stringify(booking.body));
    assert.equal(booking.body.data.status, 'PENDING', 'staff bookings without a doctor wait in the queue too');
    assert.equal(booking.body.data.source, 'STAFF');
    const d1 = await ids('doctor@cadovet.com');
    assert.equal((await api.get(`/api/appointments/${booking.body.data.id}`, { token: drA })).status, 404);
    assert.equal((await assign(ops, booking.body.data.id, { doctor_id: d1.doctor_id })).status, 200);
    assert.equal((await api.get(`/api/appointments/${booking.body.data.id}`, { token: drA })).status, 200);
    const login = await h.loginWithOtp(mobile);
    const mine = (await api.get('/api/appointments', { token: login.body.data.token })).body.data;
    assert.equal(mine.length, 1);
    assert.deepEqual([mine[0].status, mine[0].pet_name, mine[0].source], ['CONFIRMED', 'Tiger', 'STAFF']);
  });
  it('the operational head can book straight to a doctor for a caller (CONFIRMED at once)', async () => {
    const c = await h.signupCustomer(); const pet = await h.createPet(c.token);
    const custId = (await h.db.query('SELECT id FROM customers WHERE user_id = $1', [c.userId])).rows[0].id;
    const d1 = await ids('doctor@cadovet.com');
    const r = await api.post('/api/appointments', { customer_id: custId, pet_id: pet.id, doctor_id: d1.doctor_id, appointment_date: monday(), appointment_time: '04:00 PM' }, { token: ops });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.deepEqual([r.body.data.status, r.body.data.doctor_id], ['CONFIRMED', d1.doctor_id]);
    assert.equal((await api.get(`/api/appointments/${r.body.data.id}`, { token: drA })).status, 200);
  });
  it('staff booking needs the customer and a pet that belongs to them', async () => {
    const a = await h.signupCustomer(); const b = await h.signupCustomer(); const petA = await h.createPet(a.token);
    const bId = (await h.db.query('SELECT id FROM customers WHERE user_id = $1', [b.userId])).rows[0].id;
    const base = { service_id: 1, appointment_date: monday(), appointment_time: '11:00 AM' };
    assert.equal((await api.post('/api/appointments', { ...base, pet_id: petA.id }, { token: ops })).status, 400, 'no customer');
    assert.equal((await api.post('/api/appointments', { ...base, pet_id: petA.id, customer_id: bId }, { token: ops })).status, 400, 'pet is not theirs');
    assert.equal((await api.post('/api/appointments', { ...base, pet_id: petA.id, customer_id: 99999999 }, { token: ops })).status, 400, 'unknown customer');
  });
});

describe('Staff accounts: email + password, set up by the administrator', () => {
  const TEMP = 'Temp1234';
  it('the admin adds a doctor with email + a temporary password; the doctor signs in and can be assigned work', async () => {
    const email = `newdoc${Date.now()}@cadovet.test`;
    const locationId = await h.firstActiveLocationId();
    const r = await api.post('/api/doctors', { name: 'Dr. New Vet', email, password: TEMP, specialization: 'Exotic pets', qualification: 'BVSc', available_days: 'Mon,Wed', available_from: '10:00', available_to: '14:00', consultation_fee: 700, location_ids: [locationId] }, { token: admin });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const login = await api.post('/api/auth/login', { identifier: email, password: TEMP });
    assert.equal(login.status, 200);
    assert.equal(login.body.data.user.must_change_password, true, 'a temporary password must be replaced at first sign-in');
    const me = (await api.get('/api/auth/me', { token: login.body.data.token })).body.data;
    assert.equal(me.role_name, 'DOCTOR');
    assert.ok((await api.get('/api/doctors', { token: ops })).body.data.some((d) => d.id === r.body.data.id));
    const req = await h.pendingRequest({ appointment_date: monday(), appointment_time: '10:00 AM' });
    assert.equal((await assign(ops, req.appointment.id, { doctor_id: r.body.data.id })).status, 200);
    assert.equal((await api.get(`/api/appointments/${req.appointment.id}`, { token: login.body.data.token })).status, 200);
    assert.equal((await assign(ops, req.appointment.id, { doctor_id: r.body.data.id, appointment_time: '03:00 PM' })).status, 400, 'works Mon/Wed 10:00-14:00 only');
  });
  it('doctor creation needs a real email and a policy-compliant password, and validates schedule and duplicates', async () => {
    const ok = { name: 'Dr. Valid', specialization: 'General', location_ids: [await h.firstActiveLocationId()] };
    const email = () => `d${Date.now()}${Math.floor(Math.random() * 1e6)}@cadovet.test`;
    assert.equal((await api.post('/api/doctors', { ...ok, password: TEMP }, { token: admin })).status, 400, 'email required');
    assert.equal((await api.post('/api/doctors', { ...ok, email: 'nope', password: TEMP }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/doctors', { ...ok, email: email() }, { token: admin })).status, 400, 'password required');
    for (const password of ['short1', 'alllettersss', '12345678', 'a'.repeat(73) + '1']) {
      assert.equal((await api.post('/api/doctors', { ...ok, email: email(), password }, { token: admin })).status, 400, password);
    }
    assert.equal((await api.post('/api/doctors', { ...ok, email: email(), password: TEMP, mobile: 'abc' }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/doctors', { name: 'x', email: email(), password: TEMP, specialization: 'G' }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/doctors', { name: 'Dr. X', email: email(), password: TEMP }, { token: admin })).status, 400, 'specialization required');
    for (const sched of [{ available_days: 'Funday' }, { available_from: '25:00' }, { available_from: '18:00', available_to: '09:00' }, { available_to: 'late' }]) {
      assert.equal((await api.post('/api/doctors', { ...ok, email: email(), password: TEMP, ...sched }, { token: admin })).status, 400, JSON.stringify(sched));
    }
    const dup = email();
    assert.equal((await api.post('/api/doctors', { ...ok, email: dup, password: TEMP }, { token: admin })).status, 201, 'mobile is optional');
    assert.equal((await api.post('/api/doctors', { ...ok, email: dup, password: TEMP }, { token: admin })).status, 409);
    assert.equal((await api.post('/api/doctors', { ...ok, email: email(), password: TEMP }, { token: ops })).status, 403);
    assert.equal((await api.post('/api/doctors', { ...ok, email: email(), password: TEMP }, { token: drA })).status, 403);
  });
  it('a doctor\'s schedule edit is validated too, so assignment always has sane hours to check', async () => {
    const d = await ids('doctor@cadovet.com');
    assert.equal((await api.put(`/api/doctors/${d.doctor_id}`, { available_from: '20:00', available_to: '08:00' }, { token: admin })).status, 400);
    assert.equal((await api.put(`/api/doctors/${d.doctor_id}`, { status: 'RETIRED' }, { token: admin })).status, 400);
    assert.equal((await api.put(`/api/doctors/${d.doctor_id}`, { bio: 'Updated' }, { token: admin })).status, 200);
  });
  it('the admin creates an operational head with email + temporary password', async () => {
    const roles = (await api.get('/api/roles', { token: admin })).body.data;
    const roleId = roles.find((r) => r.name === 'OPERATIONAL_HEAD').id;
    const deptId = (await h.db.query("SELECT id FROM departments WHERE name = 'OPERATIONAL'")).rows[0].id;
    const email = `ops2${Date.now()}@cadovet.test`;
    const r = await api.post('/api/users', { name: 'Second Ops', email, password: TEMP, role_id: roleId, department_id: deptId, location_ids: [await h.firstActiveLocationId()] }, { token: admin });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const token = await h.loginStaff(email, TEMP);
    assert.ok((await api.get('/api/auth/me', { token })).body.data.permissions.includes('APPOINTMENT_ASSIGN'));
    assert.equal((await api.post('/api/users', { name: 'Second Ops', email, password: TEMP, role_id: roleId, location_ids: [await h.firstActiveLocationId()] }, { token: admin })).status, 409, 'duplicate email');
  });
  it('user creation needs email + password; mobile is optional; customers and doctors have their own pages', async () => {
    const roles = (await api.get('/api/roles', { token: admin })).body.data;
    const id = (n) => roles.find((r) => r.name === n).id;
    const e = () => `u${Date.now()}${Math.floor(Math.random() * 1e6)}@cadovet.test`;
    const locationId = await h.firstActiveLocationId();
    assert.equal((await api.post('/api/users', { name: 'No Email', password: TEMP, role_id: id('PHARMACY'), location_ids: [locationId] }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'No Password', email: e(), role_id: id('PHARMACY'), location_ids: [locationId] }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'Weak', email: e(), password: 'abc', role_id: id('PHARMACY'), location_ids: [locationId] }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'Bad Mobile', email: e(), password: TEMP, mobile: '123', role_id: id('PHARMACY'), location_ids: [locationId] }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'A Doctor', email: e(), password: TEMP, role_id: id('DOCTOR') }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'A Customer', email: e(), password: TEMP, role_id: id('CUSTOMER') }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'Ghost Role', email: e(), password: TEMP, role_id: 999999 }, { token: admin })).status, 400);
    assert.equal((await api.post('/api/users', { name: 'No Branch', email: e(), password: TEMP, role_id: id('PHARMACY') }, { token: admin })).status, 400, 'a desk role needs at least one branch');
    assert.equal((await api.post('/api/users', { name: 'Ok User', email: e(), password: TEMP, role_id: id('PHARMACY'), location_ids: [locationId] }, { token: admin })).status, 201);
  });
  it('in production too: staff sign in with a password, and OTP still cannot reach a staff account', () => {
    const script = `
      const http = require('http'); const app = require('./src/app');
      const s = http.createServer(app).listen(0, async () => {
        const base = 'http://127.0.0.1:' + s.address().port;
        const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.status);
        console.log(JSON.stringify({
          staffPassword: await post('/api/auth/login', { identifier: 'admin@cadovet.com', password: 'admin123' }),
          staffOtp: await post('/api/auth/otp/send', { mobile: '9876543210', purpose: 'login' }),
          customerOtp: await post('/api/auth/otp/send', { mobile: '9876543213', purpose: 'login' }),
        })); process.exit(0);
      });`;
    const env = { PATH: process.env.PATH, DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48), CORS_ORIGIN: 'https://cadovet.com', OTP_TEST_CODE: '', OTP_TEST_MOBILES: '' };
    const r = spawnSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', env, timeout: 20000 });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.deepEqual(out, { staffPassword: 200, staffOtp: 404, customerOtp: 200 });
  });
});
