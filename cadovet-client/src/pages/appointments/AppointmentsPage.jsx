import React, { useState, useEffect, useContext, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getAppointments, callIntake, updateAppointmentStatus, cancelAppointment, assignAppointment, getAvailability } from '../../services/appointmentApi';
import { getDoctors } from '../../services/doctorApi';
import { getServices } from '../../services/serviceApi';
import { AuthContext } from '../../context/AuthContext';

const STATUS_COLORS = {
  CONFIRMED: { bg: '#e6fffa', text: '#234e52', border: '#b2f5ea', label: 'Confirmed' },
  PENDING: { bg: '#fffaf0', text: '#7b341e', border: '#feebc8', label: 'Pending' },
  COMPLETED: { bg: '#f0fff4', text: '#22543d', border: '#c6f6d5', label: 'Completed' },
  CANCELLED: { bg: '#fff5f5', text: '#742a2a', border: '#fed7d7', label: 'Cancelled' },
};
const SOURCE_LABEL = { APP: '📱 App', WEBSITE: '🌐 Website', STAFF: '☎️ Phone' };
const today = () => new Date().toISOString().split('T')[0];
const errText = (err, fallback) => err.response?.data?.message || fallback;

const Modal = ({ title, onClose, children, width = 640 }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
    <div className="modal-scroll" style={{ background: '#fff', borderRadius: '20px', maxWidth: width, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-dark)' }}>{title}</h2>
        <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

// Time-slot picker fed by the availability API; unavailable slots are shown but disabled.
const SlotSelect = ({ slots, value, onChange, loading, emptyText, testId }) => (
  <select className="form-input" value={value} onChange={(e) => onChange(e.target.value)} required disabled={loading || slots.length === 0} data-testid={testId}>
    <option value="">{loading ? 'Loading slots…' : slots.length ? 'Select a time' : emptyText}</option>
    {slots.map((s) => <option key={s.time} value={s.time} disabled={!s.available}>{s.time}{s.emergency ? ' 🚨 emergency' : ''}{s.available ? '' : ' — taken'}</option>)}
  </select>
);

const AppointmentsPage = () => {
  const { hasPermission } = useContext(AuthContext);
  const canAssign = hasPermission('APPOINTMENT_ASSIGN');
  const canCreate = hasPermission('APPOINTMENT_CREATE');
  const canCancel = hasPermission('APPOINTMENT_CANCEL');
  const canUpdate = hasPermission('APPOINTMENT_UPDATE');

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  // QUEUE = requests that still need a doctor (the operational head's work list)
  const [filter, setFilter] = useState(canAssign ? 'QUEUE' : 'ALL');
  const [searchDate, setSearchDate] = useState('');
  const [toast, setToast] = useState('');

  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);

  const [detail, setDetail] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100, date: searchDate || undefined };
      if (filter === 'QUEUE') { params.assigned = 'false'; params.status = 'PENDING'; }
      else if (filter === 'EMERGENCY') { params.emergency = 'true'; params.status = 'ALL'; }
      else params.status = filter;
      const res = await getAppointments(params);
      setAppointments(res.data.data || []);
    } catch (e) {
      console.error('Failed to load appointments:', e);
    } finally {
      setLoading(false);
    }
  }, [filter, searchDate]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    (async () => {
      try {
        const [srv, doc] = await Promise.all([
          getServices({ is_active: true }),
          hasPermission('DOCTOR_VIEW') ? getDoctors({ limit: 100 }) : Promise.resolve({ data: { data: [] } }),
        ]);
        setServices(srv.data.data || []);
        setDoctors((doc.data.data || []).filter((d) => d.status === 'ACTIVE'));
      } catch (e) { console.error('Failed to load options:', e); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = async (id) => {
    try { await updateAppointmentStatus(id, { status: 'COMPLETED' }); showToast('Appointment status changed to COMPLETED'); setDetail(null); fetchAppointments(); }
    catch (err) { alert(errText(err, 'Failed to update status')); }
  };
  const cancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try { await cancelAppointment(id); showToast('Appointment cancelled.'); setDetail(null); fetchAppointments(); }
    catch (err) { alert(errText(err, 'Failed to cancel appointment')); }
  };

  const queueCount = appointments.filter((a) => !a.doctor_id && a.status === 'PENDING').length;
  const count = (s) => appointments.filter((a) => a.status === s).length;
  const isDoctorView = !canAssign && !canCreate; // a doctor: only their own, read + complete

  const tabs = [
    // Renamed from "Needs doctor" — that read like a list of doctors, not what it actually is: requests still
    // waiting for one to be picked.
    ...(canAssign ? [['QUEUE', '🩺 Assign a Doctor']] : []),
    ['ALL', isDoctorView ? 'All my visits' : 'All visits'], ['EMERGENCY', '🚨 Emergency'], ['CONFIRMED', 'Confirmed'],
    // A doctor's own appointments only ever arrive CONFIRMED (assignment sets that status directly), and the one
    // path that would revert one to PENDING also clears its doctor_id — so it leaves their view entirely rather
    // than showing up here. "Pending" is a queue concept for the operational head/admin, not a doctor.
    ...(isDoctorView ? [] : [['PENDING', 'Pending']]),
    ['COMPLETED', 'Completed'], ['CANCELLED', 'Cancelled'],
  ];

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {toast && (
          <div role="status" style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)', color: '#fff', padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontWeight: '600', fontSize: '14px' }}>
            <span>✓</span> {toast}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)', letterSpacing: '-0.5px' }}>
              {isDoctorView ? 'My Appointments' : 'Veterinary Appointments'}
            </h1>
            <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px' }}>
              {isDoctorView ? 'Visits assigned to you by the operational head' : 'Requests from the app, the website and phone calls arrive here; assign each one to a doctor'}
            </p>
          </div>
          {canCreate && (
            <button onClick={() => setShowAdd(true)} data-testid="schedule-btn" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(27,175,191,0.35)' }}>
              📞 Booking visit
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[
            ...(canAssign ? [['Unassigned Requests', queueCount, '#c05621']] : []),
            ['Emergency (9 PM–9 AM)', appointments.filter((a) => a.is_emergency && (a.status === 'PENDING' || a.status === 'CONFIRMED')).length, '#b91c1c'],
            ['Shown', appointments.length, 'var(--text-dark)'], ['Confirmed', count('CONFIRMED'), '#2b6cb0'], ['Completed', count('COMPLETED'), '#276749'],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '13px', color, fontWeight: '600' }}>{label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color, marginTop: '6px' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {tabs.map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} data-testid={`filter-${key}`} style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', border: filter === key ? 'none' : '1px solid var(--border)', background: filter === key ? 'var(--primary)' : '#f7fafc', color: filter === key ? '#fff' : 'var(--text-medium)', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-medium)', fontWeight: '600' }}>Filter Date:</span>
            <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} />
            {searchDate && <button onClick={() => setSearchDate('')} style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '12px' }}>Clear</button>}
          </div>
        </div>

        {filter === 'QUEUE' && (
          <div style={{ background: '#fffaf0', border: '1px solid #feebc8', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#7b341e' }}>
            🩺 These are requests that came in without a doctor picked yet — open each one and use <strong>"Assign doctor"</strong> to confirm it.
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>Loading appointments…</div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
              <h3 style={{ color: 'var(--text-dark)', fontWeight: '700' }}>{filter === 'QUEUE' ? 'No unassigned requests right now' : 'No Appointments Found'}</h3>
              <p style={{ fontSize: '14px', marginTop: '4px' }}>{isDoctorView ? 'Appointments appear here once the operational head assigns them to you.' : 'There are no visits matching the selected filters.'}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border)', color: 'var(--text-medium)', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '16px 20px' }}>Patient (Pet)</th>
                    <th style={{ padding: '16px 20px' }}>Pet Parent</th>
                    <th style={{ padding: '16px 20px' }}>Date & Time</th>
                    <th style={{ padding: '16px 20px' }}>Doctor & Service</th>
                    <th style={{ padding: '16px 20px' }}>Status</th>
                    <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => {
                    const st = STATUS_COLORS[a.status] || STATUS_COLORS.PENDING;
                    const active = a.status === 'PENDING' || a.status === 'CONFIRMED';
                    const date = new Date(a.appointment_date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                    return (
                      <tr key={a.id} data-testid={`appt-${a.id}`} style={{ borderBottom: '1px solid #edf2f7', ...(a.is_emergency && active ? { background: '#fff7ed', boxShadow: 'inset 4px 0 0 #dc2626' } : {}) }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-dark)' }}>🐾 {a.pet_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{a.pet_species} • {a.pet_breed || 'Standard'}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '600', color: 'var(--text-dark)' }}>{a.customer_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{a.customer_mobile || a.customer_email}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '700', color: 'var(--text-dark)' }}>{date}</div>
                          <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>⏰ {a.appointment_time}</div>
                          {a.is_emergency && <div data-testid={`emergency-${a.id}`} style={{ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>🚨 EMERGENCY</div>}
                          {a.source && <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>{SOURCE_LABEL[a.source] || a.source}</div>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: '600', color: a.doctor_name ? 'var(--text-dark)' : '#c05621' }}>{a.doctor_name || 'Needs a doctor'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{a.service_name ? `${a.service_name} (₹${a.charged_price ?? a.service_price}${a.is_emergency && a.charged_price !== a.service_price ? ' emergency rate' : ''})` : 'General Visit'}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: st.bg, color: st.text, border: `1px solid ${st.border}`, display: 'inline-block' }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button onClick={() => setDetail(a)} style={btn('#edf2f7', '#2d3748')}>View</button>
                            {canAssign && active && (
                              <button onClick={() => setAssignTarget(a)} data-testid={`assign-${a.id}`} title="Assign to a doctor" style={btn(a.doctor_id ? '#e2e8f0' : '#1BAFBF', a.doctor_id ? '#2d3748' : '#fff')}>
                                {a.doctor_id ? '↔ Reassign' : '👨‍⚕️ Assign doctor'}
                              </button>
                            )}
                            {canUpdate && a.status === 'CONFIRMED' && (
                              <button onClick={() => complete(a.id)} title="Mark as Completed" style={btn('#c6f6d5', '#22543d')}>✓ Complete</button>
                            )}
                            {canCancel && active && (
                              <button onClick={() => cancel(a.id)} title="Cancel Appointment" style={btn('#fed7d7', '#742a2a')}>✕</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {assignTarget && (
          <AssignModal appt={assignTarget} doctors={doctors} onClose={() => setAssignTarget(null)}
            onDone={(msg) => { setAssignTarget(null); showToast(msg); fetchAppointments(); }} />
        )}
        {showAdd && (
          <BookModal services={services} doctors={canAssign ? doctors : []} onClose={() => setShowAdd(false)}
            onDone={(msg) => {
              setShowAdd(false);
              showToast(msg);
              // The new entry might not match whatever filter/date was active (e.g. still on "Assign a Doctor" after
              // assigning one, or a stale date filter from earlier browsing) — reset both so it's guaranteed to be
              // on screen immediately, not just saved.
              setFilter('ALL');
              setSearchDate('');
              fetchAppointments();
            }} />
        )}
        {detail && (
          <Modal title="Appointment details" onClose={() => setDetail(null)} width={560}>
            {[['Patient', `${detail.pet_name} (${detail.pet_species})`], ['Pet parent', `${detail.customer_name} — ${detail.customer_mobile || detail.customer_email || ''}`],
              ['When', `${String(detail.appointment_date).slice(0, 10)} · ${detail.appointment_time}`], ['Doctor', detail.doctor_name || 'Not assigned yet'],
              ['Service', detail.service_name ? `${detail.service_name} (₹${detail.charged_price ?? detail.service_price}${detail.is_emergency && detail.charged_price !== detail.service_price ? ' emergency rate' : ''})` : 'General visit'],
              ...(detail.is_emergency ? [['Priority', '🚨 Emergency — starts between 9 PM and 9 AM']] : []), ['Reason', detail.reason || '—'], ['Notes', detail.notes || '—'],
              ['Requested via', SOURCE_LABEL[detail.source] || detail.source || '—'], ['Status', (STATUS_COLORS[detail.status] || {}).label || detail.status]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: '1px solid #edf2f7' }}>
                <div style={{ width: '120px', color: 'var(--text-light)', fontSize: '13px', fontWeight: 600 }}>{k}</div>
                <div style={{ color: 'var(--text-dark)', fontSize: '14px' }}>{v}</div>
              </div>
            ))}
          </Modal>
        )}
      </div>
    </AdminLayout>
  );
};

const btn = (bg, color) => ({ padding: '6px 12px', borderRadius: '8px', border: 'none', background: bg, color, cursor: 'pointer', fontSize: '13px', fontWeight: '600' });

// Operational head: choose the doctor and a free slot of that doctor's schedule, then confirm.
const AssignModal = ({ appt, doctors, onClose, onDone }) => {
  const [doctorId, setDoctorId] = useState(appt.doctor_id ? String(appt.doctor_id) : '');
  const [date, setDate] = useState(String(appt.appointment_date).slice(0, 10));
  const [time, setTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!doctorId || !date) { setSlots([]); return; }
    let live = true;
    setLoadingSlots(true);
    getAvailability({ date, doctorId })
      .then((r) => {
        if (!live) return;
        const list = r.data.data.slots || [];
        setSlots(list);
        // Keep the customer's requested time when this doctor is free then; the current slot of a reassigned visit counts as free.
        const wanted = String(appt.appointment_time || '').trim().toUpperCase();
        const match = list.find((s) => s.time.toUpperCase() === wanted && (s.available || appt.doctor_id === Number(doctorId)));
        setTime(match ? match.time : '');
      })
      .catch(() => live && setSlots([]))
      .finally(() => live && setLoadingSlots(false));
    return () => { live = false; };
  }, [doctorId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      await assignAppointment(appt.id, { doctor_id: Number(doctorId), appointment_date: date, appointment_time: time });
      const doc = doctors.find((d) => String(d.id) === doctorId);
      onDone(`Assigned to ${doc ? doc.name : 'doctor'} — appointment confirmed`);
    } catch (err) { setError(errText(err, 'Could not assign the doctor')); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={appt.doctor_id ? 'Reassign doctor' : 'Assign a doctor'} onClose={onClose} width={560}>
      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-medium)' }}>
        <strong style={{ color: 'var(--text-dark)' }}>{appt.pet_name}</strong> ({appt.customer_name}) requested <strong>{String(appt.appointment_date).slice(0, 10)}</strong>, <strong>{appt.appointment_time}</strong>
        {appt.service_name ? ` — ${appt.service_name}` : ''}
        {appt.is_emergency && <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontWeight: '700' }}>🚨 Emergency-hours visit (9 PM – 9 AM). Any doctor can be put on it; their usual working hours do not apply.</div>}
      </div>
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">Doctor *</label>
          <select className="form-input" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required data-testid="assign-doctor">
            <option value="">Select a doctor</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.specialization} ({d.available_days}, {String(d.available_from).slice(0, 5)}–{String(d.available_to).slice(0, 5)})</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label className="form-label">Date *</label>
            <input type="date" className="form-input" value={date} min={today()} onChange={(e) => setDate(e.target.value)} required data-testid="assign-date" />
          </div>
          <div>
            <label className="form-label">Time *</label>
            <SlotSelect slots={slots} value={time} onChange={setTime} loading={loadingSlots} emptyText={doctorId ? 'Doctor not working that day' : 'Choose a doctor first'} testId="assign-time" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btn('#edf2f7', '#2d3748')}>Cancel</button>
          <button type="submit" disabled={saving || !doctorId || !time} data-testid="assign-submit" className="btn-primary" style={{ padding: '10px 22px', borderRadius: '10px' }}>
            {saving ? 'Assigning…' : 'Assign & confirm'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Operational head: book for a caller. Without a doctor it joins the queue like any other request.
const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'];

// Operational head: one form for the whole call. The pet parent and pet are found by mobile/name or created on
// the spot — nothing has to be pre-registered first. Whichever button is pressed, that pet parent + pet record is
// saved; only the appointment's own outcome differs (a real booked slot, or a declined call kept as a lead/contact).
const BookModal = ({ services, doctors, onClose, onDone }) => {
  const [form, setForm] = useState({
    owner_name: '', mobile: '', email: '', address: '',
    pet_name: '', species: 'Dog', breed: '',
    service_id: '', doctor_id: '', appointment_date: today(), appointment_time: '', reason: '', notes: '',
  });
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null); // null | 'BOOKED' | 'DECLINED' — which action is in flight
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!form.appointment_date) return undefined;
    let live = true;
    setLoadingSlots(true);
    getAvailability({ date: form.appointment_date, doctorId: form.doctor_id || undefined })
      .then((r) => { if (live) { setSlots(r.data.data.slots || []); set({ appointment_time: '' }); } })
      .catch(() => live && setSlots([]))
      .finally(() => live && setLoadingSlots(false));
    return () => { live = false; };
  }, [form.appointment_date, form.doctor_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (outcome) => {
    setError('');
    if (!form.owner_name.trim() || !form.mobile.trim()) return setError('Pet parent name and mobile number are required.');
    if (!form.pet_name.trim()) return setError('Pet name is required.');
    if (!form.appointment_date) return setError('Choose a date.');
    if (outcome === 'BOOKED' && !form.appointment_time) return setError('Choose a time slot to book — or use "Not Booking" if the caller doesn\'t want one.');

    setSaving(outcome);
    try {
      const res = await callIntake({
        owner_name: form.owner_name.trim(), mobile: form.mobile.trim(),
        email: form.email.trim() || undefined, address: form.address.trim() || undefined,
        pet_name: form.pet_name.trim(), species: form.species, breed: form.breed.trim() || undefined,
        service_id: form.service_id || undefined, doctor_id: form.doctor_id || undefined,
        appointment_date: form.appointment_date, appointment_time: form.appointment_time || undefined,
        reason: form.reason.trim() || undefined, notes: form.notes.trim() || undefined,
        outcome,
      });
      onDone(res.data.message);
    } catch (err) { setError(errText(err, 'Failed to save')); }
    finally { setSaving(null); }
  };

  const { user } = useContext(AuthContext);

  return (
    <Modal title="📞 Log a Call" onClose={onClose} width={700}>
      {user?.active_location_name && (
        <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '14px' }}>
          Logging this call for <strong style={{ color: 'var(--text-dark)' }}>{user.active_location_name}</strong>
          {user.locations?.length > 1 ? ' — switch branch from the top bar if this call is for a different one.' : ''}
        </div>
      )}
      {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}

      <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Pet Parent</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label className="form-label">Full Name *</label>
          <input className="form-input" value={form.owner_name} onChange={(e) => set({ owner_name: e.target.value })} placeholder="e.g. Rahul Verma" required data-testid="book-owner-name" />
        </div>
        <div>
          <label className="form-label">Mobile Number *</label>
          <input className="form-input" value={form.mobile} onChange={(e) => set({ mobile: e.target.value })} placeholder="9876543210" required data-testid="book-mobile" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label className="form-label">Email</label>
          <input type="email" className="form-input" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="Optional" />
        </div>
        <div>
          <label className="form-label">Address</label>
          <input className="form-input" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Optional — for a home visit" />
        </div>
      </div>

      <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Pet Patient</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label className="form-label">Pet Name *</label>
          <input className="form-input" value={form.pet_name} onChange={(e) => set({ pet_name: e.target.value })} placeholder="e.g. Max" required data-testid="book-pet-name" />
        </div>
        <div>
          <label className="form-label">Species</label>
          <select className="form-input" value={form.species} onChange={(e) => set({ species: e.target.value })}>
            {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Breed</label>
          <input className="form-input" value={form.breed} onChange={(e) => set({ breed: e.target.value })} placeholder="Optional" />
        </div>
      </div>

      <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Visit</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label className="form-label">Service</label>
          <select className="form-input" value={form.service_id} onChange={(e) => set({ service_id: e.target.value })}>
            <option value="">General visit</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} (₹{s.price})</option>)}
          </select>
        </div>
        {doctors.length > 0 && (
          <div>
            <label className="form-label">Doctor (optional — leave empty to queue)</label>
            <select className="form-input" value={form.doctor_id} onChange={(e) => set({ doctor_id: e.target.value })} data-testid="book-doctor">
              <option value="">Assign later</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
              {form.doctor_id
                ? 'Books straight onto this doctor\'s schedule.'
                : 'Leave as "Assign later" and this lands in the Assign a Doctor queue instead of booking a specific doctor now.'}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label className="form-label">Date *</label>
          <input type="date" className="form-input" value={form.appointment_date} min={today()} onChange={(e) => set({ appointment_date: e.target.value })} required />
        </div>
        <div>
          <label className="form-label">Time (needed only to book)</label>
          <SlotSelect slots={slots} value={form.appointment_time} onChange={(v) => set({ appointment_time: v })} loading={loadingSlots} emptyText="No slots that day" testId="book-time" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Reason for visit</label>
        <input className="form-input" value={form.reason} maxLength={200} onChange={(e) => set({ reason: e.target.value })} placeholder="e.g. Vaccination booster" />
      </div>
      <div className="form-group">
        <label className="form-label">Call Notes</label>
        <input className="form-input" value={form.notes} maxLength={500} onChange={(e) => set({ notes: e.target.value })} placeholder="Anything worth remembering about this call" />
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-light)', margin: '4px 0 16px' }}>
        The pet parent and pet details above are saved either way — the button you pick only decides whether this becomes a booked appointment.
      </div>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" onClick={onClose} style={btn('#edf2f7', '#2d3748')}>Close</button>
        <button type="button" onClick={() => submit('DECLINED')} disabled={!!saving} data-testid="book-decline" style={btn('#fed7d7', '#742a2a')}>
          {saving === 'DECLINED' ? 'Saving…' : '✕ Not Booking (Save Details)'}
        </button>
        <button type="button" onClick={() => submit('BOOKED')} disabled={!!saving} data-testid="book-submit" className="btn-primary" style={{ padding: '10px 22px', borderRadius: '10px' }}>
          {saving === 'BOOKED' ? 'Booking…' : '✓ Book Appointment'}
        </button>
      </div>
    </Modal>
  );
};

export default AppointmentsPage;
