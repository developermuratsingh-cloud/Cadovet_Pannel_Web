import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LOGO_URL, HELPLINE_PHONE, HELPLINE_CALL } from '../../constants/cadovetCatalog';

// SEO location-service links, grouped the way the marketing site groups them: one service per column,
// one line per city it's offered in. The cities have no dedicated pages of their own, so each line links
// to the closest real category page rather than a dead route.
const PLACES_WE_SERVE = [
  { label: 'Dog Grooming', link: '/dog-grooming', cities: ['Delhi', 'Noida', 'Grtr. Noida', 'Ghaziabad'] },
  { label: 'Minor Surgery', link: '/major-minor-surgery', cities: ['Delhi', 'Noida', 'Greater Noida', 'Ghaziabad'] },
  { label: 'Major Surgery', link: '/major-minor-surgery', cities: ['Delhi', 'Noida', 'Greater Noida', 'Ghaziabad'] },
  { label: 'Veterinary Doctor', link: '/services', cities: ['Delhi', 'Noida', 'Grtr Noida', 'Ghaziabad'] },
];

const QUICK_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'About us', to: '/about-us' },
  { label: 'Dogs Packages', to: '/dogs-packages' },
  { label: 'Cat Packages', to: '/cat-packages' },
  { label: 'Consultation', to: '/consultation' },
  { label: 'Vaccination', to: '/vaccination' },
];

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/cadovet_home_pet_service?stkn=aHgyMTgyMGRoMHpx&utm_source=ig_contact_invite', path: 'M12 2c2.7 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.46.66.26 1.21.6 1.76 1.15.55.55.9 1.1 1.15 1.76.24.64.41 1.37.46 2.43C21.97 8.94 22 9.3 22 12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.46 2.43-.26.66-.6 1.21-1.15 1.76-.55.55-1.1.9-1.76 1.15-.64.24-1.37.41-2.43.46C15.06 21.97 14.7 22 12 22s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.46-.66-.26-1.21-.6-1.76-1.15-.55-.55-.9-1.1-1.15-1.76-.24-.64-.41-1.37-.46-2.43C2.03 15.06 2 14.7 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.46-2.43.26-.66.6-1.21 1.15-1.76.55-.55 1.1-.9 1.76-1.15.64-.24 1.37-.41 2.43-.46C8.94 2.03 9.3 2 12 2zm0 1.8c-2.65 0-2.99.01-4.04.06-.86.04-1.32.18-1.63.3-.41.16-.7.35-1.01.66-.31.31-.5.6-.66 1.01-.12.31-.26.77-.3 1.63C4.31 8.51 4.3 8.85 4.3 12s.01 3.49.06 4.54c.04.86.18 1.32.3 1.63.16.41.35.7.66 1.01.31.31.6.5 1.01.66.31.12.77.26 1.63.3C8.51 20.19 8.85 20.2 12 20.2s3.49-.01 4.54-.06c.86-.04 1.32-.18 1.63-.3.41-.16.7-.35 1.01-.66.31-.31.5-.6.66-1.01.12-.31.26-.77.3-1.63.05-1.05.06-1.39.06-4.54s-.01-3.49-.06-4.54c-.04-.86-.18-1.32-.3-1.63-.16-.41-.35-.7-.66-1.01-.31-.31-.6-.5-1.01-.66-.31-.12-.77-.26-1.63-.3C15.49 3.81 15.15 3.8 12 3.8zm0 3.05a5.15 5.15 0 1 1 0 10.3 5.15 5.15 0 0 1 0-10.3zm0 1.8a3.35 3.35 0 1 0 0 6.7 3.35 3.35 0 0 0 0-6.7zm5.35-2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z' },
  { label: 'Facebook', href: 'https://www.facebook.com/share/1FLgtK5iQk/', path: 'M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.56V4.46c-.27-.04-1.2-.12-2.27-.12-2.25 0-3.78 1.37-3.78 3.89v2.17H7.98v2.96h2.5V21h3.02z' },
  { label: 'X', href: 'https://x.com/cadovet66790', path: 'M18.24 3h2.9l-6.34 7.25L22.5 21h-5.83l-4.57-5.98L6.9 21H4l6.78-7.75L2 3h5.98l4.13 5.47L18.24 3zm-1.02 16.17h1.6L7.85 4.74H6.13l11.09 14.43z' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/cadovet-pet-vet-services-44279a33a', path: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9.5 9H13v1.64h.05c.49-.92 1.68-1.9 3.46-1.9 3.7 0 4.38 2.44 4.38 5.6V21h-4v-5.14c0-1.23-.02-2.8-1.71-2.8-1.72 0-1.98 1.34-1.98 2.72V21h-4z' },
  { label: 'YouTube', href: 'https://youtube.com/@cadovet?si=M-nagSNcyJGwewrs', path: 'M22 12s0-3.2-.41-4.74a2.75 2.75 0 0 0-1.93-1.93C18.12 5 12 5 12 5s-6.12 0-7.66.33A2.75 2.75 0 0 0 2.4 7.26 28.6 28.6 0 0 0 2 12s0 3.2.41 4.74a2.75 2.75 0 0 0 1.93 1.93C5.88 19 12 19 12 19s6.12 0 7.66-.33a2.75 2.75 0 0 0 1.93-1.93C22 15.2 22 12 22 12zM9.9 15.02V8.98L15.4 12l-5.5 3.02z' },
];

const PublicFooter = () => {
  const navigate = useNavigate();

  return (
    <footer className="public-footer" style={{ background: '#eaf6f7', color: '#374151' }}>
      {/* Places We Serve */}
      <div style={{ background: '#fff', padding: '48px 20px 36px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
          <h4 style={{ color: '#111827', fontSize: '22px', fontWeight: '900', marginBottom: '24px' }}>
            Places We Serve
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '28px' }}>
            {PLACES_WE_SERVE.map((group) => (
              <div key={group.label} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {group.cities.map((city) => (
                  <Link
                    key={city}
                    to={group.link}
                    style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}
                  >
                    {group.label} In {city}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '48px 20px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '40px', marginBottom: '36px' }}>
          {/* Col 1: Brand & Mission */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', cursor: 'pointer' }} onClick={() => navigate('/')}>
              <img src={LOGO_URL} alt="Cadovet" style={{ height: '46px' }} onError={(e) => { e.target.style.display = 'none'; }} />
              <span style={{ fontSize: '24px', fontWeight: '900', color: '#1BAFBF', letterSpacing: '-0.5px' }}>
                CADO<span style={{ color: '#84cc16' }}>VET</span>
              </span>
            </div>
            <p style={{ fontSize: '13.5px', lineHeight: '1.7', color: '#4b5563', marginBottom: '20px', maxWidth: '340px' }}>
              At Cadovet, we aim to unite pet lovers worldwide with expert tips, heartwarming stories, and resources
              to help you care for your furry companion. As passionate pet lovers, we're here to make pet care
              simple and enjoyable—one happy woof at a time!
            </p>
            <div style={{ fontSize: '13.5px', color: '#374151' }}>
              📞 Helpline: <a href={HELPLINE_CALL} style={{ color: '#1BAFBF', textDecoration: 'none', fontWeight: '700' }}>{HELPLINE_PHONE}</a>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 style={{ color: '#111827', fontSize: '16px', fontWeight: '900', marginBottom: '20px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Quick Links
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14.5px' }}>
              {QUICK_LINKS.map((link) => (
                <li key={link.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#84cc16', fontSize: '13px' }}>✔️</span>
                  <Link to={link.to} style={{ color: '#374151', textDecoration: 'none' }}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Follow Us + Download App */}
          <div>
            <h4 style={{ color: '#111827', fontSize: '16px', fontWeight: '900', marginBottom: '20px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Follow Us
            </h4>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0,
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#111827"><path d={social.path} /></svg>
                </a>
              ))}
            </div>

            <h4 style={{ color: '#111827', fontSize: '16px', fontWeight: '900', marginBottom: '16px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Download App
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a href="#" aria-label="Get it on Google Play" className="app-badge app-badge--play">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M4 3.5c-.3.3-.5.7-.5 1.2v14.6c0 .5.2.9.5 1.2l.1.1L12.5 12 4.1 3.4 4 3.5z" /><path d="M15.3 14.8 12.5 12l2.8-2.8 3.5 2c.6.3.6 1.2 0 1.6l-3.5 2z" opacity=".85" /><path d="M15.3 14.8 12.5 12 4.1 20.6c.3.3.8.4 1.4.1l9.8-5.9z" opacity=".7" /><path d="M15.3 9.2 5.5 3.3c-.6-.3-1.1-.2-1.4.1L12.5 12l2.8-2.8z" opacity=".55" /></svg>
                <span>
                  <div style={{ fontSize: '9.5px', lineHeight: 1.2 }}>GET IT ON</div>
                  <strong style={{ fontSize: '14px' }}>Google Play</strong>
                </span>
              </a>
              <a href="#" aria-label="Download on the App Store" className="app-badge app-badge--apple">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                  <path d="M16.37 1.43c0 1.14-.46 2.17-1.22 2.94-.86.86-2.09 1.51-3.13 1.42-.12-1.12.43-2.27 1.17-2.98.8-.78 2.14-1.35 3.18-1.38zM20.6 17.14c-.53 1.22-.78 1.76-1.46 2.84-.95 1.52-2.29 3.42-3.94 3.44-1.47.02-1.85-.96-3.84-.95-1.99.01-2.41.97-3.88.95-1.65-.02-2.92-1.72-3.87-3.24-2.65-4.24-2.93-9.21-1.29-11.86 1.16-1.87 2.99-2.96 4.71-2.96 1.75 0 2.85 1.01 4.3 1.01 1.4 0 2.26-1.01 4.29-1.01 1.53 0 3.15.83 4.31 2.27-3.79 2.08-3.18 7.5.67 9.51z" />
                </svg>
                <span>
                  <div style={{ fontSize: '9.5px', lineHeight: 1.2 }}>Download on the</div>
                  <strong style={{ fontSize: '14px' }}>App Store</strong>
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Strip */}
        <div style={{
          borderTop: '1px solid #d1e8ec', padding: '20px 0', textAlign: 'center', fontSize: '13.5px', color: '#374151'
        }}>
          <a href="https://cadovet.com/" target="_blank" rel="noreferrer" style={{ color: '#1BAFBF', textDecoration: 'none', fontWeight: '700' }}>
            Cadovet
          </a> ©Copyright {new Date().getFullYear()} | Powered By <span style={{ color: '#1BAFBF', fontWeight: '700' }}>Braintech Info Solutions</span>
        </div>
      </div>

      {/* Floating Action Buttons */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <a
          href={`https://wa.me/919220410777?text=${encodeURIComponent('Hello Cadovet! I would like to book a doorstep vet consultation for my pet.')}`}
          target="_blank"
          rel="noreferrer"
          title="Chat on WhatsApp"
          style={{
            width: '54px', height: '54px', borderRadius: '50%', background: '#25D366', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37,211,102,0.4)', textDecoration: 'none', cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="30" height="30" viewBox="0 0 32 32" fill="#fff">
            <path d="M16.01 3C9.38 3 4 8.38 4 15.01c0 2.2.6 4.34 1.73 6.22L4 29l7.94-1.68a12.05 12.05 0 0 0 4.07.71h.01c6.63 0 12.01-5.38 12.01-12.01C28.03 8.38 22.65 3 16.01 3zm0 21.98h-.01a9.93 9.93 0 0 1-5.06-1.39l-.36-.21-3.79.8.81-3.7-.24-.38a9.92 9.92 0 0 1-1.53-5.28c0-5.49 4.47-9.96 9.98-9.96 2.66 0 5.16 1.04 7.04 2.92a9.9 9.9 0 0 1 2.92 7.05c0 5.49-4.48 9.15-9.76 9.15zm5.47-7.45c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.22 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z" />
          </svg>
        </a>
      </div>
    </footer>
  );
};

export default PublicFooter;
