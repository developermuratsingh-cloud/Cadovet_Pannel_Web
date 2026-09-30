import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import BranchSwitcher from '../../components/BranchSwitcher';

// The landing page for the two desk roles: PHARMACY and INVENTORY. Every module below links only to a route
// that role can actually land on (cross-checked against the allowedRoles on each <Route> in App.jsx) — a module
// pointing at a page the role is routed away from is worse than not listing it. Appointments, Customers, Pets,
// Invoices, Services and Audit Logs are all ADMIN/OPERATIONAL_HEAD(/DOCTOR)-only routes, so neither desk gets a
// card for them here.
const ROLE_CONFIG = {
  INVENTORY: {
    icon: '📦',
    color: '#FF5722',
    label: 'Inventory Control',
    modules: [
      { icon: '📦', title: 'Inventory & Supplies', desc: 'General supplies catalog & real-time stock levels', perm: 'INVENTORY_VIEW', path: '/admin/inventory' },
      { icon: '⚠️', title: 'Low Stock Alerts', desc: 'Restock warnings & reordering', perm: 'INVENTORY_VIEW', path: '/admin/inventory' },
      { icon: '👨‍⚕️', title: 'Doctors / Staff', desc: 'Who to dispense assigned items to', perm: 'DOCTOR_VIEW', path: '/admin/doctors' },
      { icon: '📋', title: 'Stock Reports & Disputes', desc: 'Flagged stock issues awaiting review', path: '/admin/stock-disputes' },
    ]
  },
  PHARMACY: {
    icon: '💊',
    color: '#E91E63',
    label: 'Pharmacy Dispensary',
    modules: [
      { icon: '💊', title: 'Pharmacy Inventory', desc: 'Medicines, vaccines & unit pricing', perm: 'MEDICINE_VIEW', path: '/admin/pharmacy' },
      { icon: '🩺', title: 'Prescriptions Review', desc: 'Doctor prescriptions & dosing notes', perm: 'MEDICAL_RECORD_VIEW', path: '/admin/medical-records' },
      { icon: '👨‍⚕️', title: 'Doctors / Staff', desc: 'Who to dispense assigned items to', perm: 'DOCTOR_VIEW', path: '/admin/doctors' },
      { icon: '📋', title: 'Stock Reports & Disputes', desc: 'Flagged stock issues awaiting review', path: '/admin/stock-disputes' },
    ]
  },
};

const DeskDashboard = () => {
  const { user, logout, hasPermission } = useContext(AuthContext);
  const navigate = useNavigate();
  const desk = ROLE_CONFIG[user?.role_name] || ROLE_CONFIG.PHARMACY;
  const visibleModules = desk.modules.filter(mod => !mod.perm || hasPermission(mod.perm));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-light)', fontFamily: 'Poppins, sans-serif' }}>
      {/* This is the landing page for Pharmacy/Inventory staff — it doesn't sit inside AdminLayout, so it must
          enforce the forced password change itself or a staff member could use their temporary password indefinitely. */}
      {user?.must_change_password && <ChangePasswordModal forced />}
      {/* Header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid var(--border)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: `linear-gradient(135deg, ${desk.color}, var(--primary))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
          }}>{desk.icon}</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)' }}>CADOVET</div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{desk.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: '6px 14px', fontSize: '12.5px', fontWeight: '600', color: 'var(--text-dark)',
              cursor: 'pointer'
            }}
          >
            📋 Admin Panel View
          </button>
          <div style={{
            background: `${desk.color}15`, border: `1px solid ${desk.color}30`,
            borderRadius: 'var(--radius-full)', padding: '4px 14px',
            fontSize: '12px', fontWeight: '600', color: desk.color
          }}>{desk.label.replace(' Dispensary', '').replace(' Control', '')}</div>
          <BranchSwitcher />
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)' }}>{user?.name}</div>
          <button onClick={logout} style={{
            background: 'var(--bg-light)', border: '1.5px solid var(--border)',
            color: 'var(--text-medium)', padding: '7px 16px', borderRadius: 'var(--radius-full)',
            cursor: 'pointer', fontSize: '13px', fontFamily: 'Poppins, sans-serif'
          }}>Logout</button>
        </div>
      </header>

      <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
        {/* Welcome Banner */}
        <div style={{
          background: `linear-gradient(135deg, ${desk.color}, ${desk.color}cc)`,
          borderRadius: 'var(--radius-lg)',
          padding: '26px 30px',
          color: '#fff',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '5px' }}>👋 Welcome back,</div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '5px' }}>{user?.name}</h1>
            <div style={{ fontSize: '13.5px', opacity: 0.9 }}>{desk.label} — Your clinical and operations workspace.</div>
          </div>
          <div style={{ fontSize: '64px', opacity: 0.2 }}>{desk.icon}</div>
        </div>

        {/* Module Cards */}
        <div style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)' }}>
          Assigned Modules
        </div>
        {visibleModules.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 'var(--radius-md)', padding: '28px', border: '1px solid var(--border)', color: 'var(--text-light)', fontSize: '14px' }}>
            No modules are assigned to your account yet. Ask an administrator to check your role's permissions.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {visibleModules.map((mod) => {
            return (
              <div
                key={mod.title}
                onClick={() => mod.path && navigate(mod.path)}
                style={{
                  background: '#fff',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px 20px',
                  boxShadow: 'var(--shadow-sm)',
                  border: '1px solid var(--border)',
                  cursor: mod.path ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  if (mod.path) {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = desk.color;
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{mod.icon}</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '4px' }}>{mod.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: mod.path ? '12px' : '0' }}>{mod.desc}</div>
                {mod.path && (
                  <div style={{ fontSize: '12px', fontWeight: '700', color: desk.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Open Module →
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeskDashboard;
