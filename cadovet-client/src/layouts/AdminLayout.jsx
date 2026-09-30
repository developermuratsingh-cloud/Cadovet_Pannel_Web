import React, { useContext, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import BranchSwitcher from '../components/BranchSwitcher';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: '🏠', path: '/admin', permission: null },
  { label: 'Appointments', icon: '📅', path: '/admin/appointments', permission: 'APPOINTMENT_VIEW' },
  // A doctor still needs PET_VIEW under the hood (it feeds the patient picker in Clinical Records), but the
  // standalone patient directory isn't part of their panel — hidden for DOCTOR below, not permission-gated.
  { label: 'Patients (Pets)', icon: '🐾', path: '/admin/pets', permission: 'PET_VIEW', hideForRoles: ['DOCTOR'] },
  // Prescriptions (write/upload/view) live inside Clinical Records — one section, not two.
  { label: 'Clinical Records', icon: '🩺', path: '/admin/medical-records', permission: 'MEDICAL_RECORD_VIEW' },
  { label: 'Invoices & Billing', icon: '💳', path: '/admin/invoices', permission: 'INVOICE_VIEW' },
  // Pharmacy (medicines) and Inventory (general supplies) are two different desks/roles. A PHARMACY account only
  // ever works the pharmacy desk, so the Inventory link is hidden for them (and vice versa) even though both
  // roles hold both view permissions (the department scoping that actually matters happens server-side);
  // ADMIN/OPERATIONAL_HEAD see both.
  { label: 'Pharmacy', icon: '💊', path: '/admin/pharmacy', permission: 'MEDICINE_VIEW', hideForRoles: ['INVENTORY'] },
  { label: 'Inventory', icon: '📦', path: '/admin/inventory', permission: 'INVENTORY_VIEW', hideForRoles: ['PHARMACY'] },
  { label: 'My Stock', icon: '🎒', path: '/admin/my-stock', permission: null, onlyForRoles: ['DOCTOR'] },
  { label: 'Stock Reports', icon: '⚠️', path: '/admin/stock-disputes', permission: null, onlyForRoles: ['ADMIN', 'OPERATIONAL_HEAD', 'PHARMACY', 'INVENTORY'] },
  { label: 'Services & Fees', icon: '✨', path: '/admin/services', permission: 'SERVICE_VIEW' },
  { label: 'Doctors / Staff', icon: '👨‍⚕️', path: '/admin/doctors', permission: 'DOCTOR_VIEW' },
  { label: 'Customers', icon: '👥', path: '/admin/customers', permission: 'CUSTOMER_VIEW' },
  { label: 'System Users', icon: '👤', path: '/admin/users', permission: 'USER_CREATE' },
  { label: 'Branches', icon: '🏢', path: '/admin/locations', permission: 'LOCATION_MANAGE' },
  { label: 'Roles & Matrix', icon: '🛡️', path: '/admin/roles', permission: 'ROLE_MANAGE' },
  { label: 'Audit Logs', icon: '📋', path: '/admin/audit-logs', permission: 'REPORT_VIEW' },
];

const AdminLayout = ({ children }) => {
  const { user, logout, hasPermission } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  const navigate = useNavigate();

  const visibleNav = NAV_ITEMS.filter(item =>
    (!item.permission || hasPermission(item.permission))
    && !item.hideForRoles?.includes(user?.role_name)
    && !item.hideForDepartments?.includes(user?.department_name)
    && (!item.onlyForRoles || item.onlyForRoles.includes(user?.role_name))
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-light)', fontFamily: 'Poppins, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? '240px' : '64px',
        background: 'linear-gradient(180deg, #1a2332 0%, #2d3748 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        flexShrink: 0,
        zIndex: 100,
        boxShadow: '4px 0 20px rgba(0,0,0,0.15)'
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarOpen ? '20px 20px 16px' : '20px 10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px'
          }}>🐾</div>
          {sidebarOpen && (
            <div>
              <div style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-0.3px' }}>CADOVET</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>Admin Panel</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {visibleNav.map(({ label, icon, path }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/admin'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: sidebarOpen ? '11px 20px' : '11px',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                background: isActive ? 'rgba(27,175,191,0.25)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                textDecoration: 'none',
                fontSize: '13.5px',
                fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
            >
              <span style={{ fontSize: '17px', flexShrink: 0 }}>{icon}</span>
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div style={{
          padding: sidebarOpen ? '14px 16px' : '14px 8px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '700', color: '#fff'
          }}>
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          {sidebarOpen && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{user?.role_name}</div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top Header */}
        <header style={{
          background: '#fff',
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '20px', color: 'var(--text-medium)', padding: '4px 8px',
              borderRadius: 'var(--radius-sm)'
            }}
            title="Toggle Sidebar"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <BranchSwitcher />
            <button onClick={() => setChangingPassword(true)} data-testid="change-password-btn" style={{
              background: 'none', border: '1.5px solid var(--border)', color: 'var(--text-medium)',
              padding: '6px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: '13px', fontFamily: 'Poppins, sans-serif'
            }}>🔒 Change password</button>
            <button onClick={logout} style={{
              background: 'none', border: '1.5px solid var(--border)', color: 'var(--text-medium)',
              padding: '6px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
              fontSize: '13px', fontFamily: 'Poppins, sans-serif', transition: 'all 0.2s'
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#e53e3e'; e.currentTarget.style.color = '#e53e3e'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-medium)'; }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          {children}
        </main>
        {/* A temporary password must be replaced before anything else can be done. */}
        {user?.must_change_password && <ChangePasswordModal forced />}
        {changingPassword && !user?.must_change_password && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
      </div>
    </div>
  );
};

export default AdminLayout;
