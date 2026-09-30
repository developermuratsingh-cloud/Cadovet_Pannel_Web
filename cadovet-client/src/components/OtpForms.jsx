import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const RESEND_SECONDS = 30;

// Server statuses -> friendly text. Everything else shows the server's own message.
const explain = (err, step) => {
  const status = err.response?.status;
  const message = err.response?.data?.message;
  if (status === 429) return step === 'send' ? 'Too many codes requested. Please try again later.' : 'Too many attempts. Please request a new code.';
  if (status === 404) return 'No account found for this mobile number. Please sign up first.';
  if (status === 409) return 'An account with this mobile number or email already exists. Please sign in.';
  if (step === 'verify' && status === 400) return 'That code is incorrect or has expired.';
  return message || 'Something went wrong. Please try again.';
};

const Field = ({ label, required, children, hint }) => (
  <div className="form-group">
    <label className="form-label">{label} {required && <span>*</span>}</label>
    {children}
    {hint && <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '4px' }}>{hint}</div>}
  </div>
);

// Step 2 of both flows: the 6-digit code that was sent by SMS.
function CodeStep({ mobile, submitLabel, onVerify, onResend, onBack, busy, error }) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resend = async () => { if (await onResend()) setCooldown(RESEND_SECONDS); };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onVerify(code.trim()); }}>
      <p style={{ fontSize: '13px', color: 'var(--text-medium)', marginBottom: '14px' }}>
        We sent a 6-digit code to <strong>{mobile}</strong>. It is valid for 10 minutes.
      </p>
      {error && <div className="alert alert-error" role="alert">⚠️ {error}</div>}
      <Field label="6-digit code" required>
        <input
          className="form-input" value={code} inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6}
          placeholder="e.g. 123456" data-testid="otp-code"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required
        />
      </Field>
      <button type="submit" className="btn-primary" disabled={busy || code.length !== 6} data-testid="otp-verify"
        style={{ width: '100%', padding: '14px', fontSize: '16px', borderRadius: 'var(--radius-md)' }}>
        {busy ? 'Verifying…' : submitLabel}
      </button>
      <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px' }}>
        <button type="button" onClick={resend} disabled={cooldown > 0}
          style={{ background: 'none', border: 'none', color: cooldown > 0 ? 'var(--text-light)' : 'var(--primary)', fontWeight: 600, cursor: cooldown > 0 ? 'default' : 'pointer' }}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '13px' }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}>
          Use a different number
        </button>
      </div>
    </form>
  );
}

// Customer sign-in: mobile number -> code. (Staff keep using email + password on the same page.)
export function OtpLoginForm() {
  const { sendOtp, loginWithOtp } = useContext(AuthContext);
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setError(''); setBusy(true);
    try { await sendOtp(mobile.trim(), 'login'); setSent(true); return true; }
    catch (err) { setError(explain(err, 'send')); return false; }
    finally { setBusy(false); }
  };
  const verify = async (code) => {
    setError(''); setBusy(true);
    try { if (await loginWithOtp(mobile.trim(), code)) navigate('/dashboard'); else setError('Sign in failed. Please try again.'); }
    catch (err) { setError(explain(err, 'verify')); }
    finally { setBusy(false); }
  };

  if (sent) {
    return <CodeStep mobile={mobile.trim()} submitLabel="Verify & sign in" onVerify={verify} onResend={send}
      onBack={() => { setSent(false); setError(''); }} busy={busy} error={error} />;
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }}>
      {error && <div className="alert alert-error" role="alert">⚠️ {error}</div>}
      <Field label="Mobile number" required hint="We will text you a 6-digit code. For a number outside India start with + and the country code.">
        <input className="form-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="9876543210" data-testid="otp-mobile"
          value={mobile} onChange={(e) => setMobile(e.target.value)} required />
      </Field>
      <button type="submit" className="btn-primary" disabled={busy || !mobile.trim()} data-testid="otp-send"
        style={{ width: '100%', padding: '14px', fontSize: '16px', borderRadius: 'var(--radius-md)' }}>
        {busy ? 'Sending…' : 'Send OTP'}
      </button>
    </form>
  );
}

// Customer sign-up: name + mobile (required) + email (optional) -> code -> signed in.
export function OtpSignupForm() {
  const { sendOtp, signupWithOtp } = useContext(AuthContext);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setError(''); setBusy(true);
    try { await sendOtp(mobile.trim(), 'signup', email.trim()); setSent(true); return true; }
    catch (err) { setError(explain(err, 'send')); return false; }
    finally { setBusy(false); }
  };
  const verify = async (code) => {
    setError(''); setBusy(true);
    try {
      const ok = await signupWithOtp({ name: name.trim(), mobile: mobile.trim(), email: email.trim(), code });
      if (ok) navigate('/dashboard'); else setError('Registration failed. Please try again.');
    } catch (err) { setError(explain(err, 'verify')); }
    finally { setBusy(false); }
  };

  if (sent) {
    return <CodeStep mobile={mobile.trim()} submitLabel="Verify & create account" onVerify={verify} onResend={send}
      onBack={() => { setSent(false); setError(''); }} busy={busy} error={error} />;
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }}>
      {error && <div className="alert alert-error" role="alert">⚠️ {error}</div>}
      <Field label="Full name" required>
        <input className="form-input" value={name} maxLength={60} autoComplete="name" placeholder="e.g. Rahul Verma" data-testid="signup-name"
          onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Mobile number" required>
        <input className="form-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="9876543210" data-testid="signup-mobile"
          value={mobile} onChange={(e) => setMobile(e.target.value)} required />
      </Field>
      <Field label="Email (optional)">
        <input className="form-input" type="email" autoComplete="email" placeholder="you@example.com" data-testid="signup-email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <button type="submit" className="btn-primary" disabled={busy || !name.trim() || !mobile.trim()} data-testid="signup-send"
        style={{ width: '100%', padding: '14px', fontSize: '16px', borderRadius: 'var(--radius-md)' }}>
        {busy ? 'Sending…' : 'Send OTP'}
      </button>
    </form>
  );
}
