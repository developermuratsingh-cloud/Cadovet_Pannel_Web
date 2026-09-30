import React, { useState, useEffect, useContext } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getUsers, createUser, toggleUserStatus, resetUserPassword } from '../../services/userApi';
import { getRoles, getDepartments } from '../../services/adminApi';
import { getLocations } from '../../services/locationApi';
import { AuthContext } from '../../context/AuthContext';

const UsersPage = () => {
  const { hasPermission } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', role_id: '', department_id: '', location_ids: [] });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getUsers({ search, page, limit: 15 });
      setUsers(res.data.data);
      setPagination(res.data.pagination);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(1), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    getRoles().then(r => setRoles(r.data.data)).catch(console.error);
    getDepartments().then(r => setDepartments(r.data.data)).catch(console.error);
    getLocations().then(r => setLocations(r.data.data.filter(l => l.status === 'ACTIVE'))).catch(console.error);
  }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const selectedRole = roles.find(r => String(r.id) === String(form.role_id));
  // Pharmacy/Inventory are desk roles whose department is implied by the role itself (never a manual pick — the
  // server pins it regardless of what's submitted). Operational Head still picks a department manually below.
  const isDeskRole = ['PHARMACY', 'INVENTORY'].includes(selectedRole?.name);
  // Every desk/branch worker needs at least one branch — it decides what their dashboard, inventory scope and
  // appointment queue show them. ADMIN is the one role that's never branch-scoped.
  const isBranchScoped = ['PHARMACY', 'INVENTORY', 'OPERATIONAL_HEAD'].includes(selectedRole?.name);
  const toggleLocation = (id) => setForm(f => ({
    ...f, location_ids: f.location_ids.includes(id) ? f.location_ids.filter(x => x !== id) : [...f.location_ids, id],
  }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setFormError('Name, email and a temporary password are required.'); return;
    }
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      setFormError('The temporary password needs at least 8 characters, with a letter and a number.'); return;
    }
    if (isBranchScoped && form.location_ids.length === 0) {
      setFormError('Assign at least one branch for this staff member.'); return;
    }
    setSaving(true); setFormError('');
    try {
      await createUser(form);
      setShowModal(false);
      setForm({ name: '', email: '', mobile: '', password: '', role_id: '', department_id: '', location_ids: [] });
      fetchUsers(1);
      showToast('User created — they sign in with their email and must change the temporary password at first sign-in.');
    } catch (e) { setFormError(e.response?.data?.message || 'Failed to create user'); }
    finally { setSaving(false); }
  };

  // Sets a new temporary password (they must change it at next sign-in) and signs them out everywhere.
  const handleResetPassword = async (u) => {
    const password = window.prompt(`New temporary password for ${u.name}\n(at least 8 characters, with a letter and a number)`);
    if (!password) return;
    try { await resetUserPassword(u.id, password); showToast(`Password reset for ${u.name}. They must choose a new one at next sign-in.`); }
    catch (e) { showToast(e.response?.data?.message || 'Could not reset the password'); }
  };

  const handleToggle = async (id, status) => {
    try {
      await toggleUserStatus(id);
      fetchUsers(pagination.page);
      showToast(`User ${status === 'ACTIVE' ? 'deactivated' : 'activated'}`);
    } catch (e) { showToast('Failed'); }
  };

  const ROLE_COLORS = { ADMIN: '#E91E63', PHARMACY: '#9C27B0', INVENTORY: '#2196F3', OPERATIONAL_HEAD: '#FF9800', DOCTOR: '#009688', CUSTOMER: '#4CAF50' };
  const DEPT_COLORS = { DOCTOR: '#2196F3', OPERATIONAL: '#FF9800', INVENTORY: '#FF5722', MEDICINE: '#E91E63' };

  return (
    <AdminLayout>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#276749', color: '#fff', padding: '12px 20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', fontSize: '14px' }}>{toast}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>Staff Users</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>{pagination.total} total users</div>
        </div>
        {hasPermission('USER_CREATE') && (
          <button onClick={() => setShowModal(true)} className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>+ Add User</button>
        )}
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍  Search by name, email or mobile..."
        className="form-input" style={{ maxWidth: '380px', marginBottom: '20px' }} />

      <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👤</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>No users found</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-light)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Name', 'Identifier', 'Role', 'Department', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-light)' }}>{(pagination.page - 1) * 15 + i + 1}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${ROLE_COLORS[u.role_name] || 'var(--primary)'}, var(--primary))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)' }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-medium)' }}>{u.email || u.mobile}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: `${ROLE_COLORS[u.role_name] || '#888'}20`, color: ROLE_COLORS[u.role_name] || '#888', border: `1px solid ${ROLE_COLORS[u.role_name] || '#888'}40`, borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: '700' }}>
                      {u.role_name}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {u.department_name && (
                      <span style={{ background: `${DEPT_COLORS[u.department_name] || '#888'}20`, color: DEPT_COLORS[u.department_name] || '#888', border: `1px solid ${DEPT_COLORS[u.department_name] || '#888'}40`, borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '11px', fontWeight: '600' }}>
                        {u.department_name}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: u.status === 'ACTIVE' ? '#f0fff4' : '#fff5f5', color: u.status === 'ACTIVE' ? '#276749' : '#c53030', border: `1px solid ${u.status === 'ACTIVE' ? '#c6f6d5' : '#fed7d7'}`, borderRadius: 'var(--radius-full)', padding: '3px 10px', fontSize: '12px', fontWeight: '600' }}>
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {hasPermission('USER_UPDATE') && u.role_name !== 'CUSTOMER' && (
                      <button onClick={() => handleResetPassword(u)} data-testid={`reset-pw-${u.id}`} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-medium)', borderRadius: 'var(--radius-md)', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', marginRight: '8px' }}>
                        Reset password
                      </button>
                    )}
                    {hasPermission('USER_UPDATE') && (
                      <button onClick={() => handleToggle(u.id, u.status)} style={{ background: 'none', border: `1px solid ${u.status === 'ACTIVE' ? '#e53e3e' : '#276749'}`, color: u.status === 'ACTIVE' ? '#e53e3e' : '#276749', padding: '5px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', fontFamily: 'Poppins, sans-serif' }}>
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '32px', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '20px' }}>Add New Staff User</h3>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dr. Sharma" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Email (sign-in) *</label>
                  <input className="form-input" type="email" data-testid="user-email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@cadovet.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label">Mobile (optional)</label>
                  <input className="form-input" type="tel" data-testid="user-mobile" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} placeholder="9876543210" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Temporary password *</label>
                <input className="form-input" type="text" autoComplete="off" data-testid="user-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="e.g. Welcome2Cadovet" required />
                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                  Share it with the person privately. They must replace it at their first sign-in. At least 8 characters, with a letter and a number.
                  Doctors are added on the Doctors page and customers on the Customers page.
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Role *</label>
                  <select className="form-input" value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value })} required>
                    <option value="">Select Role</option>
                    {roles.filter(r => !['CUSTOMER', 'DOCTOR'].includes(r.name)).map(r => <option key={r.id} value={r.id}>{r.name.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  {isDeskRole ? (
                    <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-light)', border: '1px solid var(--border)', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-dark)' }}>
                      {selectedRole.name === 'PHARMACY' ? '💊 Pharmacy (Medicine desk)' : '📦 Inventory (Supplies desk)'}
                    </div>
                  ) : (
                    <select className="form-input" value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                      <option value="">None</option>
                      {/* "Doctor" is for doctor records only, and Medicine/Inventory are auto-assigned by the Pharmacy/Inventory roles above. */}
                      {departments.filter(d => !['DOCTOR', 'MEDICINE', 'INVENTORY'].includes(d.name)).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  )}
                  {isDeskRole && <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>Set automatically by their role — decides what their dashboard and stock access look like.</div>}
                </div>
              </div>
              {isBranchScoped && (
                <div className="form-group">
                  <label className="form-label">Branch(es) *</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {locations.map(l => {
                      const on = form.location_ids.includes(l.id);
                      return (
                        <button type="button" key={l.id} onClick={() => toggleLocation(l.id)} aria-pressed={on}
                          style={{ padding: '7px 14px', borderRadius: '20px', border: on ? 'none' : '1px solid var(--border)', background: on ? 'var(--primary)' : '#f7fafc', color: on ? '#fff' : 'var(--text-medium)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                          🏢 {l.name}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>
                    Which branch(es) they work at. Pick more than one if they cover multiple locations — they'll get a switcher to move between them.
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px' }}>
                  {saving ? '⏳ Saving...' : '✓ Create User'}
                </button>
                <button type="button" onClick={() => { setShowModal(false); setFormError(''); }} style={{ flex: 1, padding: '12px', background: 'var(--bg-light)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '14px', fontFamily: 'Poppins, sans-serif' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default UsersPage;
