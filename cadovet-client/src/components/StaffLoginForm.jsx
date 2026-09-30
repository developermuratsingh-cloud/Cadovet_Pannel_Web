import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Staff sign-in: email + password. Where they land afterwards depends on their role (DashboardRouter).
export default function StaffLoginForm() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (await login(email.trim(), password)) navigate('/dashboard');
      else setError('Sign in failed. Please try again.');
    } catch (err) {
      const status = err.response?.status;
      setError(status === 429 ? (err.response.data.message || 'Too many attempts. Try again later.')
        : status === 401 ? 'Incorrect email or password.'
        : err.response?.data?.message || 'Sign in failed. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="alert alert-error" role="alert">⚠️ {error}</div>}
      <div className="form-group">
        <label className="form-label">Email <span>*</span></label>
        <input className="form-input" type="email" autoComplete="username" placeholder="you@cadovet.com" data-testid="staff-email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="form-group">
        <label className="form-label">Password <span>*</span></label>
        <div style={{ position: 'relative' }}>
          <input className="form-input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" data-testid="staff-password"
            style={{ paddingRight: '44px' }} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
            {show ? '🙈' : '👁️'}
          </button>
        </div>
      </div>
      <div style={{ textAlign: 'right', margin: '-6px 0 18px' }}>
        <Link to="/forgot-password" data-testid="forgot-link" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 500 }}>Forgot password?</Link>
      </div>
      <button type="submit" className="btn-primary" disabled={busy || !email || !password} data-testid="staff-submit"
        style={{ width: '100%', padding: '14px', fontSize: '16px', borderRadius: 'var(--radius-md)' }}>
        {busy ? 'Signing in…' : '→ Sign in'}
      </button>
    </form>
  );
}
