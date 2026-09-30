import React, { useState, useEffect } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { getLocations, createLocation, updateLocation, toggleLocationStatus, getLocationStaff } from '../../services/locationApi';

const ROLE_LABEL = { ADMIN: 'Admin', OPERATIONAL_HEAD: 'Operational Head', PHARMACY: 'Pharmacy', INVENTORY: 'Inventory', DOCTOR: 'Doctor' };

const LocationsPage = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // a location row, or null for "add"
  const [staffPanel, setStaffPanel] = useState(null); // a location row

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await getLocations();
      setLocations(res.data.data || []);
    } catch (e) {
      console.error('Failed to load branches:', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  const handleToggle = async (loc) => {
    try {
      await toggleLocationStatus(loc.id);
      showToast(`${loc.name} ${loc.status === 'ACTIVE' ? 'deactivated' : 'activated'}`);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update branch');
    }
  };

  return (
    <AdminLayout>
      {toast && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)', color: '#fff', padding: '14px 24px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', fontWeight: '600', fontSize: '14px' }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-dark)' }}>🏢 Branches</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
            Every clinic location. Each has its own stock and its own appointment queue — assign doctors and desk staff to one or more from the Users and Doctors pages.
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary" style={{ padding: '12px 22px', borderRadius: '12px' }}>+ Add branch</button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>
      ) : locations.length === 0 ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)' }}>No branches yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
          {locations.map((loc) => (
            <div key={loc.id} className="card" style={{ padding: '22px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', opacity: loc.status === 'ACTIVE' ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-dark)' }}>{loc.name}</div>
                  {loc.city && <div style={{ fontSize: '12.5px', color: 'var(--text-light)', marginTop: '2px' }}>{loc.city}</div>}
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: loc.status === 'ACTIVE' ? '#f0fff4' : '#fff5f5', color: loc.status === 'ACTIVE' ? '#276749' : '#c53030' }}>
                  {loc.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
              </div>
              {loc.address && <div style={{ fontSize: '12.5px', color: 'var(--text-medium)', marginBottom: '6px' }}>{loc.address}</div>}
              {loc.phone && <div style={{ fontSize: '12.5px', color: 'var(--text-medium)', marginBottom: '10px' }}>📞 {loc.phone}</div>}
              <div style={{ fontSize: '12.5px', color: 'var(--text-light)', marginBottom: '14px' }}>{loc.staff_count} staff rostered here</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setStaffPanel(loc)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-dark)', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' }}>View Staff</button>
                <button onClick={() => { setEditing(loc); setShowModal(true); }} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text-dark)', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => handleToggle(loc)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #fed7d7', background: '#fff5f5', color: '#c53030', fontWeight: '600', fontSize: '12.5px', cursor: 'pointer' }}>
                  {loc.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <LocationModal location={editing} onClose={() => setShowModal(false)} onDone={(msg) => { setShowModal(false); showToast(msg); fetchAll(); }} />
      )}
      {staffPanel && <StaffPanel location={staffPanel} onClose={() => setStaffPanel(null)} />}
    </AdminLayout>
  );
};

const LocationModal = ({ location, onClose, onDone }) => {
  const [form, setForm] = useState({
    name: location?.name || '', address: location?.address || '', city: location?.city || '', phone: location?.phone || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (location) {
        await updateLocation(location.id, form);
        onDone('Branch updated');
      } else {
        await createLocation(form);
        onDone('Branch added');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '460px', width: '100%', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>{location ? 'Edit branch' : 'Add a branch'}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>}
          <div className="form-group"><label className="form-label">Branch name *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Andheri Branch" required /></div>
          <div className="form-group"><label className="form-label">City</label>
            <input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mumbai" /></div>
          <div className="form-group"><label className="form-label">Address</label>
            <input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Optional" /></div>
          <div className="form-group"><label className="form-label">Phone</label>
            <input className="form-input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 1, padding: '12px' }}>{saving ? 'Saving…' : (location ? 'Save changes' : '+ Add branch')}</button>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-light)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StaffPanel = ({ location, onClose }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLocationStaff(location.id).then((res) => setStaff(res.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [location.id]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', maxWidth: '520px', width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-dark)' }}>👥 Staff at {location.name}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-light)' }}>✕</button>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-light)', marginBottom: '18px' }}>To add or remove someone, edit their branches from the Users or Doctors page.</p>
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>
        ) : staff.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>Nobody is rostered here yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {staff.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--text-dark)' }}>{s.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{ROLE_LABEL[s.role_name] || s.role_name}{s.department_name ? ` — ${s.department_name}` : ''}</div>
                </div>
                {s.is_active_here && (
                  <span style={{ fontSize: '10.5px', fontWeight: '700', padding: '3px 9px', borderRadius: 'var(--radius-full)', background: 'rgba(27,175,191,0.1)', color: 'var(--primary)' }}>Working here now</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationsPage;
