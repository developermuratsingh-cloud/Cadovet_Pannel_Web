import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { PASSWORD_HINT, passwordProblem } from '../../components/ChangePasswordModal';

// Staff password reset: email -> 6-digit code sent to that email -> new password. (Customers have no password.)
export default function ForgotPassword() {
  const { forgotPassword, resetPassword } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e?.preventDefault();
    setError(''); setBusy(true);
    try { await forgotPassword(email.trim()); setStep('reset'); }
    catch (err) { setError(err.response?.data?.message || 'Could not send the code. Please try again.'); }
    finally { setBusy(false); }
  };
  const reset = async (e) => {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('The passwords do not match.');
    setBusy(true);
    try {
      await resetPassword(email.trim(), code.trim(), password);
      navigate('/login', { state: { message: 'Password updated. Please sign in with your new password.', tab: 'staff' } });
    } catch (err) {
      const s = err.response?.status;
      setError(s === 429 ? 'Too many attempts. Please request a new code.' : s === 400 ? (err.response.data.message.includes('Password') ? err.response.data.message : 'That code is incorrect or has expired.') : 'Could not reset the password.');
    } finally { setBusy(false); }
  };

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #eaf6f8 0%, #d4f0f4 100%)', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '420px', padding: '36px', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>Forgot password?</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '20px' }}>
          {step === 'email' ? 'Enter your staff email and we will send a 6-digit code to it.' : `If ${email.trim()} belongs to a staff account, a 6-digit code has been sent. It is valid for 10 minutes.`}
        </p>
        {error && <div className="alert alert-error" role="alert" style={{ marginBottom: '14px' }}>⚠️ {error}</div>}
        {step === 'email' ? (
          <form onSubmit={send}>
            <div className="form-group"><label className="form-label">Email *</label>
              <input className="form-input" type="email" data-testid="fp-email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <button type="submit" className="btn-primary" disabled={busy} data-testid="fp-send" style={{ width: '100%', padding: '13px' }}>{busy ? 'Sending…' : 'Send code'}</button>
          </form>
        ) : (
          <form onSubmit={reset}>
            <div className="form-group"><label className="form-label">6-digit code *</label>
              <input className="form-input" inputMode="numeric" maxLength={6} autoComplete="one-time-code" data-testid="fp-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required /></div>
            <div className="form-group"><label className="form-label">New password *</label>
              <input className="form-input" type="password" autoComplete="new-password" data-testid="fp-new" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>{PASSWORD_HINT}</div></div>
            <div className="form-group"><label className="form-label">Confirm password *</label>
              <input className="form-input" type="password" autoComplete="new-password" data-testid="fp-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
            <button type="submit" className="btn-primary" disabled={busy || code.length !== 6} data-testid="fp-reset" style={{ width: '100%', padding: '13px' }}>{busy ? 'Saving…' : 'Reset password'}</button>
            <button type="button" onClick={send} disabled={busy} style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>Resend code</button>
          </form>
        )}
        <div style={{ textAlign: 'center', marginTop: '18px' }}><Link to="/login" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: 600 }}>← Back to sign in</Link></div>
      </div>
    </div>
  );
}
