import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { AuthContext } from '../../context/AuthContext';
import { getAppointments } from '../../services/appointmentApi';
import AdminDashboard from './AdminDashboard';
import DeskDashboard from './DeskDashboard';

const today = () => new Date().toISOString().split('T')[0];
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

const Card = ({ label, value, color, to, hint }) => (
  <Link to={to || '#'} style={{ textDecoration: 'none' }}>
    <div style={{ background: '#fff', padding: '22px', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '13px', color, fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '32px', fontWeight: '800', color, marginTop: '6px' }} data-testid={`stat-${label}`}>{value ?? '…'}</div>
      {hint && <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>{hint}</div>}
    </div>
  </Link>
);

const Shell = ({ title, subtitle, children }) => (
  <AdminLayout>
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-dark)' }}>{title}</h1>
      <p style={{ color: 'var(--text-light)', fontSize: '14px', margin: '4px 0 24px' }}>{subtitle}</p>
      {children}
    </div>
  </AdminLayout>
);

const total = (res) => res.data.pagination?.total ?? (res.data.data || []).length;

// Operational head: everything starts here. New requests from the app and the website wait for a doctor.
export const OpsDashboard = () => {
  const { user } = useContext(AuthContext);
  const [s, setS] = useState({});
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const [q, t, all] = await Promise.all([
          getAppointments({ assigned: 'false', status: 'PENDING', limit: 5 }),
          getAppointments({ date: today(), limit: 1 }),
          getAppointments({ status: 'CONFIRMED', limit: 1 }),
        ]);
        setQueue(q.data.data || []);
        setS({ waiting: total(q), today: total(t), confirmed: total(all) });
      } catch (e) { console.error(e); }
    })();
  }, []);
  return (
    <Shell title={`${greet()}, ${user?.name?.split(' ')[0] || ''}!`} subtitle="Operational head — appointment requests wait here until you assign a doctor">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card label="Waiting for a doctor" value={s.waiting} color="#c05621" to="/admin/appointments" hint="App, website and phone requests" />
        <Card label="Today's visits" value={s.today} color="#2b6cb0" to="/admin/appointments" />
        <Card label="Confirmed visits" value={s.confirmed} color="#276749" to="/admin/appointments" />
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <Link to="/admin/appointments" className="btn-primary" style={{ padding: '12px 20px', borderRadius: '12px', textDecoration: 'none' }}>👨‍⚕️ Open the queue</Link>
        <Link to="/admin/customers?new=1" className="btn-primary" style={{ padding: '12px 20px', borderRadius: '12px', textDecoration: 'none' }}>☎️ Register a caller</Link>
      </div>
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>Next in the queue</h3>
        {queue.length === 0 ? <div style={{ color: 'var(--text-light)', fontSize: '14px' }}>Nothing is waiting — every request has a doctor. 🎉</div> : queue.map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #edf2f7', fontSize: '14px' }}>
            <span><strong>{a.pet_name}</strong> · {a.customer_name}</span>
            <span style={{ color: 'var(--text-light)' }}>{String(a.appointment_date).slice(0, 10)} · {a.appointment_time}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
};

// Doctor: only the visits the operational head assigned to them.
export const DoctorDashboard = () => {
  const { user } = useContext(AuthContext);
  const [list, setList] = useState(null);
  useEffect(() => {
    getAppointments({ status: 'CONFIRMED', limit: 50 }).then((r) => setList(r.data.data || [])).catch(() => setList([]));
  }, []);
  const todays = (list || []).filter((a) => String(a.appointment_date).slice(0, 10) === today());
  const upcoming = (list || []).filter((a) => String(a.appointment_date).slice(0, 10) > today());
  return (
    <Shell title={`${greet()}, ${user?.name || 'Doctor'}!`} subtitle="Doctor — you see only the appointments assigned to you">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card label="Today" value={list ? todays.length : null} color="#2b6cb0" to="/admin/appointments" />
        <Card label="Upcoming" value={list ? upcoming.length : null} color="#276749" to="/admin/appointments" />
      </div>
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>Your next visits</h3>
        {list && list.length === 0 && <div style={{ color: 'var(--text-light)', fontSize: '14px' }}>No visits assigned to you yet. They appear here as soon as the operational head assigns them.</div>}
        {(list || []).slice(0, 8).map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #edf2f7', fontSize: '14px' }}>
            <span><strong>{a.pet_name}</strong> ({a.pet_species}) · {a.customer_name}</span>
            <span style={{ color: 'var(--text-light)' }}>{String(a.appointment_date).slice(0, 10)} · {a.appointment_time}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
};

// /admin shows the dashboard that matches the signed-in role.
export const AdminHome = () => {
  const { user } = useContext(AuthContext);
  if (!user) return null;
  if (user.role_name === 'OPERATIONAL_HEAD') return <OpsDashboard />;
  if (user.role_name === 'DOCTOR') return <DoctorDashboard />;
  if (['PHARMACY', 'INVENTORY'].includes(user.role_name)) return <DeskDashboard />;
  return <AdminDashboard />;
};
