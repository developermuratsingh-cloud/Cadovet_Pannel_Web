import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';

export const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';
export const passwordProblem = (v) => (v.length < 8 ? 'Use at least 8 characters.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Include at least one letter and one number.' : '');

// Change your own password. `forced` = the account still has a temporary password, so it cannot be dismissed.
export default function ChangePasswordModal({ forced = false, onClose }) {
  const { changePassword, logout } = useContext(AuthContext);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(next);
    if (problem) return setError(problem);
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('Choose a password different from the current one.');
    setBusy(true);
    try { await changePassword(current, next); setDone(true); if (!forced) setTimeout(onClose, 1200); }
    catch (err) { setError(err.response?.data?.message || 'Could not change the password.'); }
    finally { setBusy(false); }
  };

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '32px', borderRadius: 'var(--radius-lg)' }}>
        <h3 style={{ fontSize: '19px', fontWeight: 800, marginBottom: '6px' }}>{forced ? 'Choose a new password' : 'Change password'}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '18px' }}>
          {forced ? 'Your account was set up with a temporary password. Choose your own to continue.' : 'You will stay signed in here; every other device is signed out.'}
        </p>
        {done ? <div className="alert alert-success" role="status">✅ Password changed.</div> : (
          <form onSubmit={submit}>
            {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}
            <div className="form-group"><label className="form-label">{forced ? 'Temporary password' : 'Current password'} *</label>
              <input className="form-input" type="password" autoComplete="current-password" data-testid="cp-current" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">New password *</label>
              <input className="form-input" type="password" autoComplete="new-password" data-testid="cp-new" value={next} onChange={(e) => setNext(e.target.value)} required />
              <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>{PASSWORD_HINT}</div></div>
            <div className="form-group"><label className="form-label">Confirm new password *</label>
              <input className="form-input" type="password" autoComplete="new-password" data-testid="cp-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn-primary" disabled={busy} data-testid="cp-submit" style={{ flex: 1, padding: '12px' }}>{busy ? 'Saving…' : 'Change password'}</button>
              {forced
                ? <button type="button" onClick={logout} style={{ flex: 1, padding: '12px', background: 'var(--bg-light)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Sign out</button>
                : <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', background: 'var(--bg-light)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancel</button>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
