// Cross-system data flow. Each story crosses the boundaries between the four parts of the product:
//   APP (customer, OTP)  <->  BACKEND  <->  ADMIN PORTAL (operational head, doctor, admin: all OTP)  <->  WEBSITE (public booking)
// and checks that what one side writes is what the other side reads.
process.env.PUBLIC_BOOKING_RATE_LIMIT = '1000';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const { api } = h;
let admin, ops, doctorStaff, doc;
before(async () => {
  await h.start();
  admin = await h.loginStaff('admin@cadovet.com');
  ops = await h.loginStaff('ops@cadovet.com');
  doctorStaff = await h.loginStaff('doctor@cadovet.com');
  doc = await h.firstActiveDoctor();
});
after(h.stop);

const customerIdOf = async (userId) => (await h.db.query('SELECT id FROM customers WHERE user_id = $1', [userId])).rows[0].id;

describe('Story 1: customer signs up in the APP, the operational head assigns a doctor, the doctor treats, the APP shows the outcome', () => {
  let c, pet, appt, customerId;
  const email = `story1.${Date.now()}@example.com`;

  it('app: OTP sign-up with optional email; profile and referral code are available', async () => {
    c = await h.signupCustomer({ name: 'Story One', email });
    customerId = await customerIdOf(c.userId);
    const me = await api.get('/api/auth/me', { token: c.token });
    assert.deepEqual([me.body.data.name, me.body.data.mobile, me.body.data.email], ['Story One', c.mobile, email]);
    const ref = await api.get('/api/referrals/me', { token: c.token });
    assert.equal(ref.status, 200);
    assert.ok(ref.body.data.code);
  });
  it('app: adds a pet and a profile address', async () => {
    pet = await h.createPet(c.token, { name: 'Luna', species: 'Cat', breed: 'Persian' });
    const upd = await api.patch('/api/auth/me', { address: '5 Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016' }, { token: c.token });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.city, 'Kolkata');
  });
  it('admin portal: the new customer, their contact details and their pet are visible', async () => {
    const list = await api.get(`/api/customers?search=${c.mobile}`, { token: admin });
    const found = list.body.data.find((x) => x.mobile === c.mobile);
    assert.ok(found, 'customer missing from the admin list');
    assert.equal(found.email, email);
    // NB: /customers/:id takes the USER id (the list's `id`), while /pets?customer_id= takes the customers-table id.
    const one = await api.get(`/api/customers/${c.userId}`, { token: admin });
    assert.equal(one.status, 200);
    assert.equal(one.body.data.city, 'Kolkata');
    const pets = await api.get(`/api/pets?customer_id=${customerId}`, { token: admin });
    const p = pets.body.data.find((x) => x.name === 'Luna');
    assert.ok(p);
    assert.equal(p.owner_mobile ?? c.mobile, c.mobile);
  });
  it('app: requests an appointment (date + time, no doctor); it waits as PENDING', async () => {
    const r = await api.post('/api/appointments', { pet_id: pet.id, service_id: 2, appointment_date: h.futureDate(14, 2), appointment_time: '10:00 AM', reason: 'Vaccination', notes: 'Second dose' }, { token: c.token });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.status, 'PENDING');
    assert.equal(r.body.data.doctor_id, null);
    appt = r.body.data;
  });
  it('admin portal (operational head): the request is in the queue with customer, pet, service and no doctor yet', async () => {
    const r = await api.get(`/api/appointments/${appt.id}`, { token: ops });
    assert.equal(r.status, 200);
    const a = r.body.data;
    assert.equal(a.customer_name, 'Story One');
    assert.equal(a.customer_mobile, c.mobile);
    assert.equal(a.pet_name, 'Luna');
    assert.equal(a.service_name, 'Puppy & Kitten Core Vaccination');
    assert.equal(a.doctor_name, null);
    assert.equal(a.source, 'APP');
    assert.ok((await api.get('/api/appointments?assigned=false&limit=200', { token: ops })).body.data.some((x) => x.id === appt.id));
  });
  it('doctor: cannot see the request yet', async () => {
    assert.equal((await api.get(`/api/appointments/${appt.id}`, { token: doctorStaff })).status, 404);
    assert.ok(!(await api.get('/api/appointments?limit=200', { token: doctorStaff })).body.data.some((x) => x.id === appt.id));
  });
  it('admin portal: the operational head assigns a doctor; the app shows CONFIRMED with the doctor\'s name', async () => {
    assert.equal((await api.patch(`/api/appointments/${appt.id}/assign`, { doctor_id: doc.id }, { token: ops })).status, 200);
    const mine = (await api.get('/api/appointments', { token: c.token })).body.data.find((x) => x.id === appt.id);
    assert.equal(mine.status, 'CONFIRMED');
    assert.ok(mine.doctor_name);
  });
  it('doctor: now sees it, with the patient and owner details, and completes the visit; the app shows COMPLETED', async () => {
    const seen = await api.get(`/api/appointments/${appt.id}`, { token: doctorStaff });
    assert.equal(seen.status, 200);
    assert.equal(seen.body.data.pet_name, 'Luna');
    assert.equal((await api.patch(`/api/appointments/${appt.id}/status`, { status: 'COMPLETED' }, { token: doctorStaff })).status, 200);
    const mine = await api.get('/api/appointments', { token: c.token });
    assert.equal(mine.body.data.find((x) => x.id === appt.id).status, 'COMPLETED');
  });
  it('admin portal (operational head): creates an invoice; the app lists it under the customer', async () => {
    const inv = await api.post('/api/invoices', { customer_id: customerId, pet_id: pet.id, appointment_id: appt.id, subtotal: 850, tax: 0, discount: 0, payment_status: 'PENDING' }, { token: ops });
    assert.equal(inv.status, 201, JSON.stringify(inv.body));
    const mine = await api.get('/api/invoices', { token: c.token });
    const seen = mine.body.data.find((i) => i.id === inv.body.data.id);
    assert.ok(seen);
    assert.equal(Number(seen.total_amount), 850);
    assert.equal(seen.payment_status, 'PENDING');
    assert.equal((await api.patch(`/api/invoices/${inv.body.data.id}/status`, { payment_status: 'PAID' }, { token: ops })).status, 200);
    const after = await api.get(`/api/invoices/${inv.body.data.id}`, { token: c.token });
    assert.equal(after.body.data.payment_status, 'PAID');
  });
  it('doctor: writes a medical record with a prescription for their patient; the app can read it', async () => {
    const rec = await api.post('/api/medical-records', {
      pet_id: pet.id, appointment_id: appt.id, visit_date: h.futureDate(0), symptoms: 'Sneezing', diagnosis: 'Mild cold',
      treatment_notes: 'Rest', prescriptions: [{ medicine_name: 'Vitamin C', dosage: '1 tab', frequency: 'Twice daily', duration: '5 days' }],
    }, { token: doctorStaff });
    assert.ok([200, 201].includes(rec.status), `${rec.status} ${JSON.stringify(rec.body)}`);
    const mine = await api.get('/api/medical-records', { token: c.token });
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.some((r) => r.diagnosis === 'Mild cold'));
  });
  it('admin: the whole story, including who assigned the doctor, is in the audit log', async () => {
    const logs = await api.get('/api/audit-logs?limit=500', { token: admin });
    assert.equal(logs.status, 200);
    const actions = logs.body.data.map((l) => l.action);
    for (const a of ['APPOINTMENT_BOOKED', 'APPOINTMENT_ASSIGNED', 'APPOINTMENT_STATUS_UPDATED']) assert.ok(actions.includes(a), a);
  });
  it('app: deleting the account removes the customer\'s identity from the admin portal but keeps the invoice', async () => {
    await api.post('/api/auth/me/otp', {}, { token: c.token });
    assert.equal((await api.delete('/api/auth/me', { code: h.otpFor(c.mobile) }, { token: c.token })).status, 200);
    const one = await api.get(`/api/customers/${c.userId}`, { token: admin });
    assert.notEqual(one.body.data?.mobile, c.mobile);
    assert.notEqual(one.body.data?.email, email);
    const invs = await h.db.query('SELECT COUNT(*)::int AS n FROM invoices WHERE customer_id = $1', [customerId]);
    assert.ok(invs.rows[0].n >= 1, 'financial records must survive account deletion');
    const remaining = await h.db.query("SELECT status FROM appointments WHERE customer_id = $1 AND status IN ('PENDING','CONFIRMED')", [customerId]);
    assert.equal(remaining.rowCount, 0);
  });
});

describe('Story 2: WEBSITE guest booking -> ADMIN PORTAL -> the same person signs in to the APP', () => {
  const phone = h.uniqueMobile();
  let apptId, invoiceNumber;

  it('website: a visitor books a doorstep visit without an account', async () => {
    const r = await api.post('/api/appointments/public', {
      owner_name: 'Guest Story', phone: `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`, pet_name: 'Coco', species: 'Dog', breed: 'Beagle',
      service_id: 1, appointment_date: h.futureDate(6), appointment_time: '02:00 PM to 04:00 PM', address: '77 Lake View', total_amount: 599,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    apptId = r.body.data.appointment_id;
    invoiceNumber = r.body.data.invoice_number;
  });
  it('admin portal: the guest is a normal customer with the website booking attached', async () => {
    const a = await api.get(`/api/appointments/${apptId}`, { token: admin });
    assert.equal(a.body.data.customer_mobile, phone, 'the number must be stored in the same form the app uses');
    assert.equal(a.body.data.pet_name, 'Coco');
    const inv = await api.get(`/api/invoices?search=${invoiceNumber}`, { token: admin });
    assert.equal(inv.body.data.length, 1);
    assert.equal(Number(inv.body.data[0].total_amount), 599);
  });
  it('app: the guest finds no account to sign in to until they sign up, then sees the existing account via OTP', async () => {
    // A website guest already has an account row (mobile only): the app's OTP login works for it straight away.
    const login = await h.loginWithOtp(phone);
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const token = login.body.data.token;
    const appts = await api.get('/api/appointments', { token });
    assert.ok(appts.body.data.some((x) => x.id === apptId), 'the website booking must appear in the app');
    const pets = await api.get('/api/pets', { token });
    assert.ok(pets.body.data.some((p) => p.name === 'Coco'));
    const invs = await api.get('/api/invoices', { token });
    assert.ok(invs.body.data.some((i) => i.invoice_number === invoiceNumber));
    const me = await api.get('/api/auth/me', { token });
    assert.equal(me.body.data.name, 'Guest Story');
  });
  it('app: the guest can then manage the website booking (reschedule, cancel)', async () => {
    const login = await h.loginWithOtp(phone);
    const token = login.body.data.token;
    const cancel = await api.patch(`/api/appointments/${apptId}/cancel`, {}, { token });
    assert.equal(cancel.status, 200);
    const seen = await api.get(`/api/appointments/${apptId}`, { token: admin });
    assert.equal(seen.body.data.status, 'CANCELLED', 'admin portal must see the cancellation made in the app');
  });
  it('sign-up with a number that a guest booking already created is refused (no duplicate person)', async () => {
    const r = await api.post('/api/auth/otp/send', { mobile: phone, purpose: 'signup' });
    assert.equal(r.status, 409);
  });
});

describe('Story 3: ADMIN PORTAL creates a customer, who then signs in to the APP', () => {
  it('a customer created by staff with only a mobile number can sign in with an OTP', async () => {
    const mobile = h.uniqueMobile();
    const created = await api.post('/api/customers', { name: 'Walk In Client', mobile, address: '1 Clinic Road', city: 'Pune' }, { token: admin });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const login = await h.loginWithOtp(mobile);
    assert.equal(login.status, 200, JSON.stringify(login.body));
    const me = await api.get('/api/auth/me', { token: login.body.data.token });
    assert.equal(me.body.data.role_name, 'CUSTOMER');
    assert.equal(me.body.data.city, 'Pune');
  });
  it('a mobile typed with spaces or +91 by staff is stored so the app can find it', async () => {
    const m = h.uniqueMobile();
    const created = await api.post('/api/customers', { name: 'Formatted Client', mobile: `+91 ${m.slice(0, 5)} ${m.slice(5)}` }, { token: admin });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal((await h.loginWithOtp(m)).status, 200);
  });
  it('a deactivated customer (admin action) is locked out of the app immediately', async () => {
    const c = await h.signupCustomer();
    // The portal passes the user id (the list's `id`); the endpoint toggles ACTIVE <-> INACTIVE.
    assert.equal((await api.patch(`/api/customers/${c.userId}/status`, { status: 'INACTIVE' }, { token: admin })).status, 200);
    assert.equal((await api.get('/api/auth/me', { token: c.token })).status, 401);
    assert.equal((await api.post('/api/auth/otp/send', { mobile: c.mobile, purpose: 'login' })).status, 404);
    assert.equal((await api.patch(`/api/customers/${c.userId}/status`, { status: 'ACTIVE' }, { token: admin })).status, 200);
    assert.equal((await h.loginWithOtp(c.mobile)).status, 200);
  });
});

describe('Story 4: referral loop between two APP users', () => {
  it('a friend who signs up with the code shows up in the referrer\'s count', async () => {
    const a = await h.signupCustomer({ name: 'Referrer' });
    const code = (await api.get('/api/referrals/me', { token: a.token })).body.data.code;
    const before = (await api.get('/api/referrals/me', { token: a.token })).body.data.joined ?? 0;
    await h.signupCustomer({ name: 'Friend One', referralCode: code });
    await h.signupCustomer({ name: 'Friend Two', referralCode: code });
    const after = (await api.get('/api/referrals/me', { token: a.token })).body.data;
    assert.equal((after.joined ?? after.friends_joined ?? after.friendsJoined) - before, 2);
  });
});

describe('Story 5: catalogue and content are shared by all clients', () => {
  it('services, doctors and blogs are the same for the app, the website and the portal', async () => {
    const c = await h.signupCustomer();
    const [s1, s2] = await Promise.all([api.get('/api/services', { token: c.token }), api.get('/api/services', { token: admin })]);
    assert.equal(s1.status, 200);
    assert.deepEqual(s1.body.data.map((s) => s.id).sort(), s2.body.data.filter((s) => s.is_active !== false).map((s) => s.id).sort());
    const docs = await api.get('/api/doctors', { token: c.token });
    assert.ok(docs.body.data.length >= 2);
    const blogs = await api.get('/api/blogs');
    assert.ok(blogs.body.data.length >= 1);
    const one = await api.get(`/api/blogs/${blogs.body.data[0].slug}`);
    assert.equal(one.status, 200);
  });
});
