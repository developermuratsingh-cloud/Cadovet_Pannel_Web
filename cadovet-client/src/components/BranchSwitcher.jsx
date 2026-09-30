import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { setActiveLocation } from '../services/locationApi';

// ADMIN is never branch-locked (sees/filters across every branch elsewhere), so this renders nothing for them.
// A single-branch staff member sees a plain badge — nothing to switch. Only someone rostered at 2+ branches gets
// the dropdown; switching takes effect immediately everywhere else in the panel (inventory, appointments, stock
// reports), since the server reads `active_location_id` fresh on every request.
const BranchSwitcher = () => {
  const { user, refreshUser } = useContext(AuthContext);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.role_name === 'ADMIN') return null;
  const locations = user.locations || [];
  if (locations.length === 0) return null;

  if (locations.length === 1) {
    return (
      <span title="Your branch" style={{
        fontSize: '12px', fontWeight: '700', padding: '6px 14px', borderRadius: 'var(--radius-full)',
        background: 'rgba(27,175,191,0.1)', color: 'var(--primary)', whiteSpace: 'nowrap'
      }}>
        🏢 {locations[0].name}
      </span>
    );
  }

  const handleChange = async (e) => {
    const locationId = Number(e.target.value);
    if (!locationId || locationId === user.active_location_id) return;
    setError('');
    setSaving(true);
    try {
      await setActiveLocation(locationId);
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not switch branch');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <select
        value={user.active_location_id || ''}
        onChange={handleChange}
        disabled={saving}
        title="Which branch you're currently working from"
        style={{
          fontSize: '12.5px', fontWeight: '700', padding: '6px 10px', borderRadius: 'var(--radius-full)',
          background: 'rgba(27,175,191,0.1)', color: 'var(--primary)', border: '1px solid rgba(27,175,191,0.3)',
          cursor: saving ? 'wait' : 'pointer',
        }}
      >
        {locations.map((l) => <option key={l.id} value={l.id}>🏢 {l.name}</option>)}
      </select>
      {error && <span style={{ fontSize: '11px', color: '#e53e3e' }}>{error}</span>}
    </div>
  );
};

export default BranchSwitcher;
