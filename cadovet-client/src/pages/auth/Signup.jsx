import React from 'react';
import { Link } from 'react-router-dom';
import { OtpSignupForm } from '../../components/OtpForms';
import { useLanguage } from '../../context/LanguageContext';

const Signup = () => {
  const { t } = useLanguage();

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
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
        </Link>
        <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: '600', fontSize: '14px', border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-full)', padding: '8px 20px' }}>
          ← {t('backToLogin')}
        </Link>
      </header>

      {/* Main */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        background: 'linear-gradient(160deg, #eaf6f8 0%, #d4f0f4 100%)'
      }}>
        <div style={{ display: 'flex', gap: '50px', alignItems: 'flex-start', maxWidth: '860px', width: '100%' }}>

          {/* Left: Branding */}
          <div style={{ flex: 1, paddingTop: '20px' }}>
            <div style={{
              background: 'rgba(76,175,80,0.1)',
              border: '1px solid rgba(76,175,80,0.25)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 18px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              width: 'fit-content',
              fontSize: '13px',
              color: 'var(--secondary-dark)',
              fontWeight: '600',
              marginBottom: '20px'
            }}>
              🐶 Join the Cadovet Family
            </div>
            <h1 style={{
              fontSize: '36px',
              fontWeight: '800',
              color: 'var(--text-dark)',
              lineHeight: 1.25,
              letterSpacing: '-0.5px',
              marginBottom: '16px'
            }}>
              {t('registerAccount')}
            </h1>
            <p style={{ fontSize: '15px', color: 'var(--text-medium)', lineHeight: 1.7, maxWidth: '340px', marginBottom: '30px' }}>
              {t('createAccountDescription')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                ['🏥', 'Access top-rated veterinarians'],
                ['📅', 'Easy online appointment booking'],
                ['💊', 'Digital prescriptions & records'],
                ['🔔', 'Vaccination & follow-up reminders'],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: 'var(--text-medium)' }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    background: 'rgba(27,175,191,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>{icon}</span>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Signup Card */}
          <div className="card" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '36px 32px',
            borderRadius: 'var(--radius-lg)',
            flexShrink: 0,
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(27,175,191,0.15)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '26px' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', margin: '0 auto 12px'
              }}>🐾</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '4px' }}>{t('createAccount')}</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Fill in your details to get started</p>
            </div>


            <OtpSignupForm />

            <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '18px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-light)' }}>{t('alreadyAccount')} </span>
              <Link to="/login" style={{ fontSize: '14px', color: 'var(--primary)', fontWeight: '600' }}>
                {t('signInLink')} →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <footer style={{
        background: 'var(--text-dark)',
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        padding: '16px',
        fontSize: '13px'
      }}>
        © 2024 Cadovet Veterinary Hospital. All rights reserved.
      </footer>
    </div>
  );
};

export default Signup;
