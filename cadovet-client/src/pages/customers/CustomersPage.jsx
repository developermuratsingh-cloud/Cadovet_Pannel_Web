import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { getCustomers, createCustomer, toggleCustomerStatus } from '../../services/customerApi';
import { AuthContext } from '../../context/AuthContext';

const CustomersPage = () => {
  const { hasPermission } = useContext(AuthContext);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  // ?new=1 (from the dashboard's "Register a caller") opens the registration form straight away.
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState({ name: '', email: '', mobile: '', city: '', address: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const fetchCustomers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getCustomers({ search, page, limit: 15 });
      setCustomers(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchCustomers(1), 300);
    return () => clearTimeout(t);
  }, [search]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.mobile.trim()) {
      setFormError('Name and mobile number are required.');
      return;
    }
    setSaving(true); setFormError('');
    try {
      await createCustomer(form);
      setShowModal(false);
      setForm({ name: '', email: '', mobile: '', city: '', address: '' });
      setSearchParams({});
      fetchCustomers(1);
      showToast('Customer registered — they can now sign in with their mobile number and an OTP.');
    } catch (e) {
      setFormError(e.response?.data?.message || 'Failed to create customer');
    } finally { setSaving(false); }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await toggleCustomerStatus(id);
      fetchCustomers(pagination.page);
      showToast(`Customer ${currentStatus === 'ACTIVE' ? 'deactivated' : 'activated'}`);
    } catch (e) { showToast('Failed to update status'); }
  };

  const statusBadge = (status) => (
    <span style={{
      background: status === 'ACTIVE' ? '#f0fff4' : '#fff5f5',
      color: status === 'ACTIVE' ? '#276749' : '#c53030',
      border: `1px solid ${status === 'ACTIVE' ? '#c6f6d5' : '#fed7d7'}`,
      borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '12px', fontWeight: '600'
    }}>{status}</span>
  );

  return (
    <AdminLayout>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: '#276749', color: '#fff', padding: '12px 20px',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', fontSize: '14px', fontWeight: '500'
        }}>{toast}</div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>Customers</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
            {pagination.total} total customers
          </div>
        </div>
        {hasPermission('CUSTOMER_CREATE') && (
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
            + Add Customer
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search by name, email or mobile..."
          className="form-input" style={{ maxWidth: '380px' }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)', fontSize: '14px' }}>Loading...</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-dark)' }}>No customers found</div>
            <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>Add a customer to get started</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-light)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Name', 'Email', 'Mobile', 'City', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{(pagination.page - 1) * 15 + i + 1}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: '700', color: '#fff', flexShrink: 0
                      }}>{c.name?.[0]?.toUpperCase()}</div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)' }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-medium)' }}>{c.email || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-medium)' }}>{c.mobile || '—'}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-medium)' }}>{c.city || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>{statusBadge(c.status)}</td>
                  <td style={{ padding: '14px 16px', fontSize: '12px', color: 'var(--text-light)' }}>
                    {new Date(c.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {hasPermission('CUSTOMER_UPDATE') && (
                      <button onClick={() => handleToggleStatus(c.id, c.status)} style={{
                        background: 'none', border: `1px solid ${c.status === 'ACTIVE' ? '#e53e3e' : '#276749'}`,
                        color: c.status === 'ACTIVE' ? '#e53e3e' : '#276749',
                        padding: '5px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                        fontSize: '12px', fontWeight: '600', fontFamily: 'Poppins, sans-serif'
                      }}>
                        {c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => fetchCustomers(p)} style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              background: pagination.page === p ? 'var(--primary)' : 'var(--border)',
              color: pagination.page === p ? '#fff' : 'var(--text-medium)',
              cursor: 'pointer', fontWeight: '600', fontSize: '13px'
            }}>{p}</button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '32px', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '6px' }}>Register a customer</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '18px' }}>For someone who phoned the clinic. They sign in to the app or website with their mobile number and an OTP — no password is needed.</p>
            {formError && <div className="alert alert-error" style={{ marginBottom: '16px' }}>⚠️ {formError}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" data-testid="customer-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Email (optional)</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile number *</label>
                  <input className="form-input" type="tel" data-testid="customer-mobile" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="9876543210" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" />
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" disabled={saving} data-testid="customer-submit" className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {saving ? '⏳ Saving...' : '✓ Register customer'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setFormError(''); }} style={{
                  flex: 1, padding: '12px', background: 'var(--bg-light)', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '14px', fontFamily: 'Poppins, sans-serif'
                }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default CustomersPage;
