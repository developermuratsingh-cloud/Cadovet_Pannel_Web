import React, { useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getRoles, getRole, createRole, assignPermissions, getPermissions } from '../../services/adminApi';

const RolesPage = () => {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPerms, setSelectedPerms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(rolesRes.data.data);
      setAllPermissions(permsRes.data.data);
      setGroupedPermissions(permsRes.data.grouped);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSelectRole = async (role) => {
    const res = await getRole(role.id);
    setSelectedRole(res.data.data);
    setSelectedPerms(res.data.data.permissions.map(p => p.id));
  };

  const togglePerm = (permId) => {
    setSelectedPerms(prev => prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]);
  };

  const handleSavePerms = async () => {
    setSaving(true);
    try {
      await assignPermissions(selectedRole.id, selectedPerms);
      showToast('Permissions updated successfully!');
      fetchAll();
    } catch (e) { showToast('Failed to save permissions'); } finally { setSaving(false); }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    try {
      await createRole({ name: newRoleName, description: newRoleDesc });
      setShowCreateModal(false); setNewRoleName(''); setNewRoleDesc('');
      fetchAll(); showToast('Role created!');
    } catch (e) { showToast(e.response?.data?.message || 'Failed'); }
  };

  const ROLE_COLORS = { ADMIN: '#E91E63', PHARMACY: '#9C27B0', INVENTORY: '#2196F3', OPERATIONAL_HEAD: '#FF9800', DOCTOR: '#009688', CUSTOMER: '#4CAF50' };

  return (
    <AdminLayout>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: '#276749', color: '#fff', padding: '12px 20px', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', fontSize: '14px' }}>{toast}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>Roles & Permissions</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>Manage role-based access control</div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>+ New Role</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Roles List */}
        <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: '700', fontSize: '13px', color: 'var(--text-dark)', background: 'var(--bg-light)' }}>
            🛡️ Roles ({roles.length})
          </div>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)' }}>Loading...</div>
          ) : (
            roles.map(role => (
              <div key={role.id} onClick={() => handleSelectRole(role)} style={{
                padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                background: selectedRole?.id === role.id ? 'rgba(27,175,191,0.08)' : 'transparent',
                borderLeft: selectedRole?.id === role.id ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.15s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-dark)' }}>{role.name}</span>
                  <span style={{ background: `${ROLE_COLORS[role.name] || '#888'}20`, color: ROLE_COLORS[role.name] || '#888', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>
                    {role.permission_count} perms
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Permissions Assignment */}
        <div className="card" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {!selectedRole ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔑</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-dark)' }}>Select a role</div>
              <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>Click a role on the left to manage its permissions</div>
            </div>
          ) : (
            <>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-light)' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-dark)' }}>Permissions for: {selectedRole.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>{selectedPerms.length} permissions selected</div>
                </div>
                <button onClick={handleSavePerms} disabled={saving} className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                  {saving ? '⏳' : '✓ Save'}
                </button>
              </div>
              <div style={{ padding: '20px', maxHeight: '520px', overflowY: 'auto' }}>
                {Object.entries(groupedPermissions).map(([module, perms]) => (
                  <div key={module} style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ height: '1px', flex: 1, background: 'var(--border)' }}></div>
                      {module}
                      <div style={{ height: '1px', flex: 1, background: 'var(--border)' }}></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                      {perms.map(perm => (
                        <label key={perm.id} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0,
                          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${selectedPerms.includes(perm.id) ? 'var(--primary)' : 'var(--border)'}`,
                          background: selectedPerms.includes(perm.id) ? 'rgba(27,175,191,0.08)' : '#fff',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}>
                          <input type="checkbox" checked={selectedPerms.includes(perm.id)} onChange={() => togglePerm(perm.id)} style={{ accentColor: 'var(--primary)', width: 14, height: 14, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontWeight: '500', color: selectedPerms.includes(perm.id) ? 'var(--primary)' : 'var(--text-medium)', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: '400px', padding: '32px', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-dark)' }}>Create New Role</h3>
            <form onSubmit={handleCreateRole}>
              <div className="form-group">
                <label className="form-label">Role Name *</label>
                <input className="form-input" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="e.g. SUPERVISOR" required />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} placeholder="Brief description" />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '11px' }}>Create</button>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '11px', background: 'var(--bg-light)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'Poppins, sans-serif' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default RolesPage;
