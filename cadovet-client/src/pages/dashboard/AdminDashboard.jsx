import React, { useContext, useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { AuthContext } from '../../context/AuthContext';
import PermissionGuard from '../../components/PermissionGuard';
import { useNavigate } from 'react-router-dom';
import { getCustomers } from '../../services/customerApi';
import { getPets } from '../../services/petApi';
import { getAppointments } from '../../services/appointmentApi';
import { getMedicalRecords } from '../../services/medicalRecordApi';
import { getInvoices } from '../../services/invoiceApi';
import { getInventory } from '../../services/inventoryApi';

const StatCard = ({ icon, label, value, color, to }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => to && navigate(to)}
      style={{
        background: '#fff', borderRadius: 'var(--radius-md)', padding: '20px',
        boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: '14px',
        cursor: to ? 'pointer' : 'default', transition: 'all 0.2s'
      }}
      onMouseEnter={e => { if (to) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '3px', fontWeight: '500' }}>{label}</div>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useContext(AuthContext);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const [metrics, setMetrics] = useState({
    customers: '...',
    pets: '...',
    appointments: '...',
    clinicalRecords: '...',
    revenue: '...',
    lowStock: '...'
  });

  useEffect(() => {
    Promise.allSettled([
      getCustomers({ limit: 1 }),
      getPets({ limit: 1 }),
      getAppointments({ limit: 100 }),
      getMedicalRecords({ limit: 1 }),
      getInvoices({ limit: 1 }),
      getInventory({ limit: 1 })
    ]).then(([custRes, petsRes, apptRes, mrRes, invRes, stockRes]) => {
      setMetrics({
        customers: custRes.status === 'fulfilled' ? (custRes.value.data.pagination?.total ?? 0) : '—',
        pets: petsRes.status === 'fulfilled' ? (petsRes.value.data.pagination?.total ?? 0) : '—',
        appointments: apptRes.status === 'fulfilled' ? (apptRes.value.data.data?.length ?? 0) : '—',
        clinicalRecords: mrRes.status === 'fulfilled' ? (mrRes.value.data.pagination?.total ?? 0) : '—',
        revenue: invRes.status === 'fulfilled' ? `₹${(invRes.value.data.metrics?.totalRevenue ?? 0).toLocaleString()}` : '—',
        lowStock: stockRes.status === 'fulfilled' ? (stockRes.value.data.metrics?.lowStockItems ?? 0) : '—'
      });
    });
  }, []);

  return (
    <AdminLayout>
      <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Welcome Banner */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, #0d9aaa 100%)',
          borderRadius: 'var(--radius-lg)', padding: '28px 32px', color: '#fff', marginBottom: '28px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-md)'
        }}>
          <div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '4px' }}>🌅 {greeting},</div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '6px' }}>{user?.name} 👋</h1>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              Cadovet Veterinary Hospital Live Management & Analytics Workspace
            </div>
          </div>
          <div style={{ fontSize: '64px', opacity: 0.2 }}>🏥</div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <PermissionGuard permission="CUSTOMER_VIEW">
            <StatCard icon="👥" label="Total Pet Owners" value={metrics.customers} color="#1BAFBF" to="/admin/customers" />
          </PermissionGuard>
          <PermissionGuard permission="PET_VIEW">
            <StatCard icon="🐾" label="Active Pet Patients" value={metrics.pets} color="#4CAF50" to="/admin/pets" />
          </PermissionGuard>
          <PermissionGuard permission="APPOINTMENT_VIEW">
            <StatCard icon="📅" label="Hospital Visits" value={metrics.appointments} color="#FF9800" to="/admin/appointments" />
          </PermissionGuard>
          <PermissionGuard permission="MEDICAL_RECORD_VIEW">
            <StatCard icon="🩺" label="Clinical Records" value={metrics.clinicalRecords} color="#2196F3" to="/admin/medical-records" />
          </PermissionGuard>
          <PermissionGuard permission="INVOICE_VIEW">
            <StatCard icon="💰" label="Collected Revenue" value={metrics.revenue} color="#9C27B0" to="/admin/invoices" />
          </PermissionGuard>
          <PermissionGuard permission="INVENTORY_VIEW">
            <StatCard icon="📦" label="Low Stock Alerts" value={metrics.lowStock} color="#F44336" to="/admin/inventory" />
          </PermissionGuard>
        </div>

        {/* Quick Actions */}
        <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-dark)', marginBottom: '16px' }}>
          Hospital Modules & Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { icon: '📅', label: 'Appointments', path: '/admin/appointments', perm: 'APPOINTMENT_VIEW', color: '#FF9800' },
            { icon: '🐾', label: 'Pet Patients', path: '/admin/pets', perm: 'PET_VIEW', color: '#4CAF50' },
            { icon: '🩺', label: 'Clinical Records & Rx', path: '/admin/medical-records', perm: 'MEDICAL_RECORD_VIEW', color: '#2196F3' },
            { icon: '💳', label: 'Invoices & Billing', path: '/admin/invoices', perm: 'INVOICE_VIEW', color: '#9C27B0' },
            { icon: '📦', label: 'Pharmacy & Stock', path: '/admin/inventory', perm: 'INVENTORY_VIEW', color: '#F44336' },
            { icon: '✨', label: 'Services & Pricing', path: '/admin/services', perm: 'SERVICE_VIEW', color: '#009688' },
            { icon: '👨‍⚕️', label: 'Doctors & Specialists', path: '/admin/doctors', perm: 'DOCTOR_VIEW', color: '#3F51B5' },
            { icon: '👥', label: 'Pet Parents', path: '/admin/customers', perm: 'CUSTOMER_VIEW', color: '#1BAFBF' },
            { icon: '👤', label: 'Staff & Users', path: '/admin/users', perm: 'USER_CREATE', color: '#673AB7' },
            { icon: '🛡️', label: 'Roles & Matrix', path: '/admin/roles', perm: 'ROLE_MANAGE', color: '#E91E63' },
            { icon: '📋', label: 'Audit Trail', path: '/admin/audit-logs', perm: 'REPORT_VIEW', color: '#607D8B' },
          ].map(({ icon, label, path, perm, color }) => (
            <PermissionGuard key={path} permission={perm}>
              <QuickCard icon={icon} label={label} path={path} color={color} />
            </PermissionGuard>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

const QuickCard = ({ icon, label, path, color }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(path)}
      style={{
        background: '#fff', borderRadius: 'var(--radius-md)', padding: '20px 16px',
        boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-dark)' }}>{label}</div>
    </div>
  );
};

export default AdminDashboard;
