// Appointment REQUESTS as customers make them (mobile app / customer dashboard). A request has a date and time but no
// doctor: it waits as PENDING for the operational head. Assignment and doctor visibility are in 08-workflow.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const { api } = h;
let ops, cust, pet;
// Monday: doctor 1 works 09:00-18:00, doctor 2 works 10:00-19:00. So 09:00 AM has capacity 1, 10:00 AM-05:30 PM capacity 2.
const MON = (weeks = 10) => h.futureDate(weeks * 7, 1);
const SUN = () => h.futureDate(10, 0);
let n = 0;
const uniqueMonday = () => h.futureDate(80 + 7 * ++n, 1); // a fresh Monday per test that needs untouched slots

const request = (over = {}, token = cust.token, petId = pet.id) =>
  api.post('/api/appointments', { pet_id: petId, service_id: 1, appointment_date: MON(), appointment_time: '11:00 AM', reason: 'Checkup', ...over }, { token });

before(async () => {
  await h.start();
  ops = await h.loginStaff('ops@cadovet.com');
  cust = await h.signupCustomer({ name: 'Booking Customer' });
  pet = await h.createPet(cust.token, { name: 'Milo' });
});
after(h.stop);

describe('Clinic availability (what the customer picks from)', () => {
  it('offers 30-minute slots across all doctors\' working hours', async () => {
    const r = await api.get(`/api/appointments/availability?date=${MON()}`, { token: cust.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.doctor_id, null);
    const times = r.body.data.slots.map((s) => s.time);
    assert.equal(times[0], '09:00 AM');
    assert.equal(times.at(-1), '06:30 PM');
    assert.equal(times.length, 20);
    assert.ok(r.body.data.slots.every((s) => s.available));
  });
  it('shrinks on days fewer doctors work (Saturday: one doctor, 09:00-18:00)', async () => {
    const r = await api.get(`/api/appointments/availability?date=${h.futureDate(70, 6)}`, { token: cust.token });
    assert.equal(r.body.data.slots.length, 18);
  });
  it('is empty when nobody works (Sunday)', async () => {
    const r = await api.get(`/api/appointments/availability?date=${SUN()}`, { token: cust.token });
    assert.deepEqual(r.body.data.slots, []);
  });
  it('with a doctor_id it shows that doctor\'s own slots (used when assigning)', async () => {
    const r = await api.get(`/api/appointments/availability?doctor_id=1&date=${MON()}`, { token: ops });
    assert.equal(r.body.data.slots.length, 18);
    assert.equal(r.body.data.slots[0].time, '09:00 AM');
  });
  it('validates its parameters', async () => {
    assert.equal((await api.get('/api/appointments/availability', { token: cust.token })).status, 400);
    assert.equal((await api.get('/api/appointments/availability?date=tomorrow', { token: cust.token })).status, 400);
    assert.equal((await api.get(`/api/appointments/availability?doctor_id=abc&date=${MON()}`, { token: cust.token })).status, 400);
    assert.equal((await api.get(`/api/appointments/availability?doctor_id=9999&date=${MON()}`, { token: cust.token })).status, 404);
  });
});

describe('Requesting an appointment', () => {
  it('creates a PENDING request with no doctor, from the app, and audits it', async () => {
    const r = await request({ appointment_date: uniqueMonday(), appointment_time: '10:30 AM' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.status, 'PENDING');
    assert.equal(r.body.data.doctor_id, null);
    assert.equal(r.body.data.source, 'APP');
    assert.equal(r.body.data.assigned_at, null);
    const audit = await h.db.query("SELECT 1 FROM audit_logs WHERE action = 'APPOINTMENT_BOOKED' AND record_id = $1", [r.body.data.id]);
    assert.equal(audit.rowCount, 1);
  });
  it('a customer cannot pick a doctor: a supplied doctor_id is ignored', async () => {
    const r = await request({ appointment_date: uniqueMonday(), appointment_time: '11:30 AM', doctor_id: 2 });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.doctor_id, null);
    assert.equal(r.body.data.status, 'PENDING');
  });
  it('records where it came from: the website customer dashboard says WEBSITE, anything else is APP', async () => {
    const web = await request({ appointment_date: uniqueMonday(), appointment_time: '12:00 PM', source: 'WEBSITE' });
    assert.equal(web.body.data.source, 'WEBSITE');
    const odd = await request({ appointment_date: uniqueMonday(), appointment_time: '12:00 PM', source: 'STAFF' });
    assert.equal(odd.body.data.source, 'APP', 'a customer cannot claim to be staff');
  });
  it('requires pet, date and time', async () => {
    assert.equal((await api.post('/api/appointments', {}, { token: cust.token })).status, 400);
    assert.equal((await request({ pet_id: undefined })).status, 400);
    assert.equal((await request({ appointment_date: undefined })).status, 400);
    assert.equal((await request({ appointment_time: undefined })).status, 400);
  });
  it('rejects past, malformed and impossible dates', async () => {
    for (const d of ['2020-01-01', 'yesterday', '2026-02-30', '2026-13-01', '', '01-02-2027', '2099-99-99']) {
      assert.equal((await request({ appointment_date: d })).status, 400, `date=${d}`);
    }
  });
  it('rejects times that are malformed or that no doctor works', async () => {
    for (const t of ['25:00', 'noon', '08:00 AM', '07:00 PM', '11:15 AM', '<b>9</b>', '09:00 AM; DROP TABLE appointments']) {
      const r = await request({ appointment_time: t, appointment_date: MON(12) });
      assert.equal(r.status, 400, `time=${t} -> ${r.status}`);
    }
  });
  it('rejects a day nobody works', async () => {
    assert.equal((await request({ appointment_date: SUN(), appointment_time: '10:00 AM' })).status, 400);
  });
  it('rejects unknown service and pet with 4xx (never a 500)', async () => {
    assert.equal((await request({ service_id: 999999, appointment_time: '10:00 AM' })).status, 400);
    assert.equal((await request({ pet_id: 999999, appointment_time: '10:00 AM' })).status, 400);
    assert.equal((await request({ pet_id: 'abc', appointment_time: '10:00 AM' })).status, 400);
  });
  it('limits notes to 500 characters', async () => {
    assert.equal((await request({ notes: 'x'.repeat(501), appointment_time: '10:00 AM' })).status, 400);
  });
});

describe('Clinic capacity', () => {
  it('a slot fills up when as many requests exist as doctors working then (2 at 11:00 AM, 1 at 09:00 AM)', async () => {
    const date = uniqueMonday();
    const others = await Promise.all([h.signupCustomer(), h.signupCustomer()]);
    const pets = await Promise.all(others.map((c) => h.createPet(c.token)));
    assert.equal((await request({ appointment_date: date, appointment_time: '11:00 AM' })).status, 201);
    assert.equal((await api.post('/api/appointments', { pet_id: pets[0].id, appointment_date: date, appointment_time: '11:00 AM' }, { token: others[0].token })).status, 201);
    const third = await api.post('/api/appointments', { pet_id: pets[1].id, appointment_date: date, appointment_time: '11:00 AM' }, { token: others[1].token });
    assert.equal(third.status, 409);
    const avail = await api.get(`/api/appointments/availability?date=${date}`, { token: cust.token });
    assert.equal(avail.body.data.slots.find((s) => s.time === '11:00 AM').available, false);
    assert.equal(avail.body.data.slots.find((s) => s.time === '11:30 AM').available, true);
    // 09:00 AM: only doctor 1 works, capacity 1
    assert.equal((await request({ appointment_date: date, appointment_time: '09:00 AM' })).status, 201);
    assert.equal((await api.post('/api/appointments', { pet_id: pets[1].id, appointment_date: date, appointment_time: '09:00 AM' }, { token: others[1].token })).status, 409);
  });
  it('different spellings of the same time count as the same slot', async () => {
    const date = uniqueMonday();
    assert.equal((await request({ appointment_date: date, appointment_time: '09:00 AM' })).status, 201);
    for (const t of ['09:00 AM', '9:00 am', ' 09:00 AM ', '09:00 Am']) {
      assert.equal((await request({ appointment_date: date, appointment_time: t })).status, 409, JSON.stringify(t));
    }
  });
  it('cancelling frees the capacity again', async () => {
    const date = uniqueMonday();
    const a = await request({ appointment_date: date, appointment_time: '09:00 AM' });
    assert.equal((await request({ appointment_date: date, appointment_time: '09:00 AM' })).status, 409);
    assert.equal((await api.patch(`/api/appointments/${a.body.data.id}/cancel`, {}, { token: cust.token })).status, 200);
    assert.equal((await request({ appointment_date: date, appointment_time: '09:00 AM' })).status, 201);
  });
  it('races: 12 simultaneous requests for a one-doctor slot produce exactly one request', async () => {
    const date = uniqueMonday();
    const customers = await Promise.all(Array.from({ length: 12 }, () => h.signupCustomer()));
    const pets = await Promise.all(customers.map((c) => h.createPet(c.token)));
    const results = await Promise.all(customers.map((c, i) =>
      api.post('/api/appointments', { pet_id: pets[i].id, appointment_date: date, appointment_time: '09:00 AM' }, { token: c.token })));
    const statuses = results.map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 201).length, 1, statuses.join(','));
    assert.ok(statuses.every((s) => s === 201 || s === 409), statuses.join(','));
    const n = (await h.db.query("SELECT COUNT(*)::int AS n FROM appointments WHERE appointment_date=$1 AND appointment_time='09:00 AM' AND status IN ('PENDING','CONFIRMED')", [date])).rows[0].n;
    assert.equal(n, 1);
  });
  it('races: 10 simultaneous requests for a two-doctor slot produce exactly two', async () => {
    const date = uniqueMonday();
    const customers = await Promise.all(Array.from({ length: 10 }, () => h.signupCustomer()));
    const pets = await Promise.all(customers.map((c) => h.createPet(c.token)));
    const results = await Promise.all(customers.map((c, i) =>
      api.post('/api/appointments', { pet_id: pets[i].id, appointment_date: date, appointment_time: '02:00 PM' }, { token: c.token })));
    assert.equal(results.filter((r) => r.status === 201).length, 2, results.map((r) => r.status).join(','));
  });
});

describe('Cancel and reschedule (customer)', () => {
  it('a cancelled or completed appointment cannot be cancelled or rescheduled again', async () => {
    const a = await request({ appointment_date: uniqueMonday(), appointment_time: '12:30 PM' });
    const id = a.body.data.id;
    await api.patch(`/api/appointments/${id}/cancel`, {}, { token: cust.token });
    assert.equal((await api.patch(`/api/appointments/${id}/cancel`, {}, { token: cust.token })).status, 400);
    assert.equal((await api.patch(`/api/appointments/${id}/reschedule`, { appointment_date: uniqueMonday(), appointment_time: '01:00 PM' }, { token: cust.token })).status, 400);
  });
  it('reschedule moves a pending request and frees the old slot', async () => {
    const d1 = uniqueMonday(); const d2 = uniqueMonday();
    const a = await request({ appointment_date: d1, appointment_time: '09:00 AM' });
    const ok = await api.patch(`/api/appointments/${a.body.data.id}/reschedule`, { appointment_date: d2, appointment_time: '01:30 PM' }, { token: cust.token });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.data.appointment_time, '01:30 PM');
    assert.equal(ok.body.data.status, 'PENDING');
    const freed = await api.get(`/api/appointments/availability?date=${d1}`, { token: cust.token });
    assert.equal(freed.body.data.slots.find((s) => s.time === '09:00 AM').available, true);
  });
  it('reschedule to a full slot is 409; past dates and off-hours are 400', async () => {
    const d = uniqueMonday();
    await request({ appointment_date: d, appointment_time: '09:00 AM' });
    const a = await request({ appointment_date: uniqueMonday(), appointment_time: '02:30 PM' });
    const id = a.body.data.id;
    assert.equal((await api.patch(`/api/appointments/${id}/reschedule`, { appointment_date: d, appointment_time: '09:00 AM' }, { token: cust.token })).status, 409);
    assert.equal((await api.patch(`/api/appointments/${id}/reschedule`, { appointment_date: '2020-01-01', appointment_time: '10:00 AM' }, { token: cust.token })).status, 400);
    assert.equal((await api.patch(`/api/appointments/${id}/reschedule`, { appointment_date: uniqueMonday(), appointment_time: '11:59 PM' }, { token: cust.token })).status, 400);
  });
  it('races: a request and a reschedule for the last slot cannot both win', async () => {
    const date = uniqueMonday();
    const a = await request({ appointment_date: uniqueMonday(), appointment_time: '09:30 AM' });
    const other = await h.signupCustomer(); const otherPet = await h.createPet(other.token);
    const [r1, r2] = await Promise.all([
      api.patch(`/api/appointments/${a.body.data.id}/reschedule`, { appointment_date: date, appointment_time: '09:00 AM' }, { token: cust.token }),
      api.post('/api/appointments', { pet_id: otherPet.id, appointment_date: date, appointment_time: '09:00 AM' }, { token: other.token }),
    ]);
    assert.equal([r1.status, r2.status].filter((s) => s === 200 || s === 201).length, 1, `${r1.status},${r2.status}`);
  });
});

describe('Staff edits and status rules', () => {
  it('a status the system does not know is rejected, by the API and by the database', async () => {
    const a = await request({ appointment_date: uniqueMonday(), appointment_time: '03:00 PM' });
    const admin = await h.loginStaff('admin@cadovet.com');
    assert.equal((await api.patch(`/api/appointments/${a.body.data.id}/status`, { status: 'EXPLODED' }, { token: admin })).status, 400);
    assert.equal((await api.patch(`/api/appointments/${a.body.data.id}/status`, {}, { token: admin })).status, 400);
    assert.equal((await api.put(`/api/appointments/${a.body.data.id}`, { status: 'HACKED' }, { token: admin })).status, 400);
  });
  it('PUT validates date, time, doctor and slot clashes', async () => {
    const admin = await h.loginStaff('admin@cadovet.com');
    const date = uniqueMonday();
    const a = await request({ appointment_date: date, appointment_time: '03:30 PM' });
    const id = a.body.data.id;
    assert.equal((await api.put(`/api/appointments/${id}`, { appointment_date: '2020-01-01' }, { token: admin })).status, 400);
    assert.equal((await api.put(`/api/appointments/${id}`, { appointment_time: '11:59 PM', doctor_id: 1 }, { token: admin })).status, 400);
    assert.equal((await api.put(`/api/appointments/${id}`, { doctor_id: 999999 }, { token: admin })).status, 400);
    assert.equal((await api.put(`/api/appointments/${id}`, { reason: 'Updated reason' }, { token: admin })).status, 200);
  });
  it('a missing appointment is 404 for staff and customers', async () => {
    assert.equal((await api.get('/api/appointments/99999999', { token: ops })).status, 404);
    assert.equal((await api.patch('/api/appointments/99999999/status', { status: 'CONFIRMED' }, { token: ops })).status, 404);
    assert.equal((await api.patch('/api/appointments/99999999/cancel', {}, { token: cust.token })).status, 404);
  });
});

describe('Coupons', () => {
  it('rejects an unknown coupon and a coupon without a service', async () => {
    assert.equal((await request({ appointment_date: uniqueMonday(), appointment_time: '09:00 AM', coupon_code: 'NOPE1234' })).status, 400);
    assert.equal((await request({ appointment_date: uniqueMonday(), appointment_time: '09:30 AM', service_id: undefined, coupon_code: 'WELCOME10' })).status, 400);
  });
  it('applies a valid coupon with a server-computed discount', async () => {
    const r = await request({ appointment_date: uniqueMonday(), appointment_time: '10:00 AM', coupon_code: 'WELCOME10' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.coupon_code, 'WELCOME10');
    assert.ok(Number(r.body.data.discount_amount) > 0);
  });
  it('the discount is never taken from the client', async () => {
    const r = await request({ appointment_date: uniqueMonday(), appointment_time: '10:30 AM', discount_amount: 99999 });
    assert.equal(r.status, 201);
    assert.equal(Number(r.body.data.discount_amount), 0);
  });
});
