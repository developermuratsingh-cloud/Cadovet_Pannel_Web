import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { OtpLoginForm } from '../../components/OtpForms';
import StaffLoginForm from '../../components/StaffLoginForm';
import { useLanguage } from '../../context/LanguageContext';

// Customers sign in with their mobile number + a 6-digit OTP (they have no password). Staff — admin, operational head,
// doctors and the inventory / pharmacy desks — sign in with email + password. Where each lands depends on their role.
const Login = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const successMessage = location.state?.message;
  const [mode, setMode] = useState(location.state?.tab === 'staff' ? 'staff' : 'customer');

  return (
    <div className="auth-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-light)' }}>
      {/* Top Announcement Bar */}
      <div className="announcement-bar">
        🚨 24X7 Emergency &amp; Online Consultation Also Available &nbsp;|&nbsp; Call: +91 922 041 0777
      </div>

      {/* Header */}
      <header style={{
        background: '#fff',
        boxShadow: '0 2px 12px rgba(27,175,191,0.10)',
        padding: '14px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo */}
          <div style={{
            width: 60, height: 60,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1BAFBF, #4CAF50)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(27,175,191,0.35)',
            fontSize: '28px'
          }}>🐾</div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>CADOVET</div>
            <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: '500' }}>Veterinary Hospital</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--secondary)', fontWeight: '600', fontSize: '15px' }}>
          📞 Helpline
        </div>
      </header>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: 'linear-gradient(160deg, #eaf6f8 0%, #d4f0f4 100%)'
      }}>
        <div style={{ display: 'flex', gap: '60px', alignItems: 'center', maxWidth: '900px', width: '100%' }}>

          {/* Left: Hero Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'rgba(27,175,191,0.1)',
              border: '1px solid rgba(27,175,191,0.25)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              width: 'fit-content',
              fontSize: '13px',
              color: 'var(--primary)',
              fontWeight: '600'
            }}>
              🌟 Trusted by 70,000+ Pet Owners
            </div>
            <h1 style={{
              fontSize: '40px',
              fontWeight: '800',
              color: 'var(--text-dark)',
              lineHeight: 1.2,
              letterSpacing: '-1px'
            }}>
              {t('homeTitle')}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-medium)', lineHeight: 1.7, maxWidth: '360px' }}>
              {t('homeDescription')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['Quick, easy, and flexible booking', 'Qualified Veterinarians providing personalized attention', 'Follow-up support & care'].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-medium)' }}>
                  <span style={{
                    width: 22, height: 22,
                    background: 'var(--secondary)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', color: '#fff', flexShrink: 0
                  }}>✓</span>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '30px', marginTop: '10px' }}>
              {[['70K+', 'Happy Pets'], ['30K+', 'Treatments'], ['500+', 'Vets']].map(([num, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)' }}>{num}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: '500' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Login Card */}
          <div className="card" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '40px 36px',
            borderRadius: 'var(--radius-lg)',
            flexShrink: 0,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(27,175,191,0.15)'
          }}>
            {/* Card Header */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: 56, height: 56,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '26px',
                margin: '0 auto 14px'
              }}>🏥</div>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '4px' }}>{t('welcomeBack')}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>{t('signInAccount')}</p>
            </div>

            {successMessage && (
              <div className="alert alert-success">✅ {successMessage}</div>
            )}

            <div role="tablist" style={{ display: 'flex', gap: '6px', marginBottom: '22px', background: 'var(--bg-light)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              {[['customer', 'Customer (mobile OTP)'], ['staff', 'Staff (email & password)']].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={mode === key} data-testid={`tab-${key}`} onClick={() => setMode(key)}
                  style={{ flex: 1, padding: '9px 6px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12.5px',
                    background: mode === key ? '#fff' : 'transparent', color: mode === key ? 'var(--primary)' : 'var(--text-light)',
                    boxShadow: mode === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>{label}</button>
              ))}
            </div>
            {mode === 'customer' ? <OtpLoginForm /> : <StaffLoginForm />}

            {mode === 'customer' && (
            <div style={{ textAlign: 'center', marginTop: '22px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-light)' }}>{t('noAccount')} </span>
              <Link to="/signup" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: '600' }}>
                {t('createAccount')} →
              </Link>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        background: 'var(--text-dark)',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        padding: '16px',
        fontSize: '13px'
      }}>
        © 2024 Cadovet Veterinary Hospital. All rights reserved.
      </footer>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .login-hero { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
