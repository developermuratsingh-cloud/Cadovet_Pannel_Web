import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../ui/LanguageSwitcher';
import { LOGO_URL, HELPLINE_PHONE, HELPLINE_CALL, getAllProducts } from '../../constants/cadovetCatalog';

const PublicHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartCount, cartTotal } = useCart();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const searchRef = useRef(null);
  const navRef = useRef(null);

  // Filter search live
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    const q = searchQuery.toLowerCase();
    const all = getAllProducts();
    const matched = all.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.shortDesc && p.shortDesc.toLowerCase().includes(q))
    ).slice(0, 6);
    setSearchResults(matched);
    setShowSearchDropdown(true);
  }, [searchQuery]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Click/tap outside a nav dropdown (Dogs/Cats/Services) closes it — needed because a touch
  // screen never fires the hover events the dropdown normally opens/closes on.
  useEffect(() => {
    const handleClickOutsideNav = (event) => {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideNav);
    return () => document.removeEventListener('mousedown', handleClickOutsideNav);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      navigate(`/product/${searchResults[0].slug}`);
      setShowSearchDropdown(false);
      setSearchQuery('');
    } else {
      navigate('/services');
    }
  };

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="public-header" style={{ width: '100%', position: 'sticky', top: 0, zIndex: 1000, background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
      {/* 1. TOP EMERGENCY BAR */}
      <div style={{
        background: '#d4f1f4',
        borderBottom: '1px solid #b8e2e6',
        color: '#066aab',
        textAlign: 'center',
        padding: '8px 16px',
        fontSize: '12.5px',
        fontWeight: '800',
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <span>🚨 24X7 EMERGENCY & ONLINE CONSULTATION ALSO AVAILABLE —</span>
        <span>CALL:</span>
        <a href={HELPLINE_CALL} style={{ color: '#045cb4', textDecoration: 'underline', fontWeight: '900' }}>
          {HELPLINE_PHONE}
        </a>
      </div>

      {/* 2. MAIN HEADER ROW */}
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img
            src={LOGO_URL}
            alt="CadoVet Logo"
            style={{ height: '52px', objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#1BAFBF', letterSpacing: '-0.5px', lineHeight: 1 }}>
              CADO<span style={{ color: '#84cc16' }}>VET</span>
            </div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#718096', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Expert Pet Healthcare
            </div>
          </div>
        </div>

        {/* Live Search Box */}
        <div ref={searchRef} style={{ flex: '1', maxWidth: '500px', minWidth: '240px', position: 'relative' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', width: '100%' }}>
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
              style={{
                flex: 1,
                padding: '11px 16px',
                border: '1.5px solid #d1e8ec',
                borderRight: 'none',
                borderRadius: '8px 0 0 8px',
                fontSize: '13.5px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#1BAFBF',
                color: '#fff',
                border: 'none',
                padding: '0 20px',
                borderRadius: '0 8px 8px 0',
                fontWeight: '700',
                fontSize: '13.5px',
                cursor: 'pointer'
              }}
            >
              {t('search')}
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="public-search-dropdown" style={{
              position: 'absolute',
              top: '105%',
              left: 0,
              right: 0,
              background: '#fff',
              boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              zIndex: 9999,
              maxHeight: '360px',
              overflowY: 'auto'
            }}>
              {searchResults.map(item => (
                <div
                  key={item.slug}
                  onClick={() => {
                    navigate(`/product/${item.slug}`);
                    setShowSearchDropdown(false);
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={item.image} alt={item.title} style={{ width: '36px', height: '36px', objectFit: 'contain', borderRadius: '4px' }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{item.category}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1BAFBF' }}>₹{item.price}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions: cart, helpline, and user account */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle />
          <LanguageSwitcher />
          {/* Cart Widget */}
          <div
            onClick={() => navigate('/cart')}
            title="View Cart & Checkout"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0'
            }}
          >
            <div style={{ position: 'relative', fontSize: '20px' }}>
              🛒
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: '#84cc16',
                  color: '#fff',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '10px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cartCount}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12.5px' }}>
              <div style={{ fontWeight: '800', color: '#1a2332' }}>₹{cartTotal}.00</div>
              <div style={{ fontSize: '10px', color: '#718096' }}>{cartCount} {t('items')}</div>
            </div>
          </div>

          {/* Helpline Link */}
          <a
            href={HELPLINE_CALL}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#066aab',
              background: '#e0f4f7',
              padding: '8px 14px',
              borderRadius: '20px',
              textDecoration: 'none'
            }}
          >
            <span>📞</span> {t('helpline')}
          </a>

          {/* User account link */}
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'linear-gradient(135deg, #84cc16, #65a30d)',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '20px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(132, 204, 22, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>👤</span> {t('myAccount')}
            </button>
          ) : (
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'linear-gradient(135deg, #1BAFBF, #0d9aaa)',
                color: '#fff',
                border: 'none',
                padding: '9px 16px',
                borderRadius: '20px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(27,175,191,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🔐</span> {t('userLogin')}
            </button>
          )}
        </div>
      </div>

      {/* 3. LOWER NAVBAR (Full Navigation Menu) */}
      <nav style={{ borderTop: '1px solid #f1f5f9', background: '#fafbfc' }}>
        <div ref={navRef} style={{
          maxWidth: '1240px',
          margin: '0 auto',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'visible',
          flexWrap: 'wrap'
        }}>
          {/* Home */}
          <button
            onClick={() => navigate('/')}
            style={{
              background: isActive('/') && location.pathname === '/' ? '#84cc16' : 'transparent',
              color: isActive('/') && location.pathname === '/' ? '#fff' : '#4a5568',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '20px',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              margin: '6px 0',
              transition: 'all 0.2s'
            }}
          >
            {t('home')}
          </button>

          {/* About Us */}
          <button
            onClick={() => navigate('/about-us')}
            style={{
              background: isActive('/about-us') ? '#1BAFBF' : 'transparent',
              color: isActive('/about-us') ? '#fff' : '#4a5568',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '20px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              margin: '6px 0',
              transition: 'all 0.2s'
            }}
          >
            {t('about')}
          </button>

          {/* Blog */}
          <button
            onClick={() => navigate('/blog')}
            style={{
              background: isActive('/blog') ? '#1BAFBF' : 'transparent',
              color: isActive('/blog') ? '#fff' : '#4a5568',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '20px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              margin: '6px 0',
              transition: 'all 0.2s'
            }}
          >
            {t('blog')}
          </button>

          {/* Dogs Dropdown */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setOpenDropdown('dogs')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <button
              onClick={() => setOpenDropdown(openDropdown === 'dogs' ? null : 'dogs')}
              style={{
                background: isActive('/dogs-packages') ? '#1BAFBF' : 'none',
                color: isActive('/dogs-packages') ? '#fff' : '#4a5568',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '20px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                margin: '6px 0'
              }}
            >
              {t('dogs')} ▾
            </button>
            {openDropdown === 'dogs' && (
              <div className="public-nav-dropdown" style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '280px',
                background: '#fff',
                boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                borderRadius: '10px',
                padding: '10px 0',
                zIndex: 1000,
                border: '1px solid #e2e8f0'
              }}>
                {[
                  { name: 'Puppy Vaccination Package (₹5,999)', slug: 'puppy-vaccination-package' },
                  { name: 'Adult Dog Vaccination Package (₹3,399)', slug: 'adult-dog-vaccination-package' },
                  { name: 'Anti Rabies Vaccine (₹899)', slug: 'anti-rabies' },
                  { name: 'DHPPi (7-in-1 / 9-in-1) (₹1,399)', slug: 'dhppi' },
                  { name: 'Kennel Cough Protection (₹1,499)', slug: 'kennel-cough' },
                  { name: 'Corona Vaccination (₹1,299)', slug: 'corona-vaccination' },
                  { name: 'Parvo + CD (Puppy DP) (₹1,499)', slug: 'parvo-cd' },
                  { name: 'Tick & Flea Treatment (₹2,499)', slug: 'tick-treatment' }
                ].map(item => (
                  <div
                    key={item.slug}
                    onClick={() => { navigate(`/product/${item.slug}`); setOpenDropdown(null); }}
                    style={{ padding: '8px 18px', fontSize: '12.5px', color: '#334155', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    {item.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cat Dropdown */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setOpenDropdown('cat')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <button
              onClick={() => setOpenDropdown(openDropdown === 'cat' ? null : 'cat')}
              style={{
                background: isActive('/cat-packages') ? '#1BAFBF' : 'none',
                color: isActive('/cat-packages') ? '#fff' : '#4a5568',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '20px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                margin: '6px 0'
              }}
            >
              {t('cats')} ▾
            </button>
            {openDropdown === 'cat' && (
              <div className="public-nav-dropdown" style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '280px',
                background: '#fff',
                boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                borderRadius: '10px',
                padding: '10px 0',
                zIndex: 1000,
                border: '1px solid #e2e8f0'
              }}>
                {[
                  { name: 'Kitten Vaccination Package (₹3,599)', slug: 'kitten-vaccination-pack' },
                  { name: 'Adult Cat Vaccination Package (₹1,999)', slug: 'adult-cat-vaccination-package' },
                  { name: 'Anti-Rabies Vaccination (₹899)', slug: 'anti-rabies-vaccination-cat' },
                  { name: 'Tick Treatment (Cat) (₹1,599)', slug: 'trick-treatment-cat' },
                  { name: 'Feline CRP (Tri-Cat) Vaccine (₹1,499)', slug: 'feline-crptri-cat-vaccine' }
                ].map(item => (
                  <div
                    key={item.slug}
                    onClick={() => { navigate(`/product/${item.slug}`); setOpenDropdown(null); }}
                    style={{ padding: '8px 18px', fontSize: '12.5px', color: '#334155', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    {item.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vaccination Guide */}
          <button
            onClick={() => navigate('/vaccination')}
            style={{
              background: isActive('/vaccination') ? '#1BAFBF' : 'transparent',
              color: isActive('/vaccination') ? '#fff' : '#4a5568',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '20px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              margin: '6px 0',
              transition: 'all 0.2s'
            }}
          >
            {t('vaccination')}
          </button>

          {/* Services Dropdown */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setOpenDropdown('services')}
            onMouseLeave={() => setOpenDropdown(null)}
          >
            <button
              onClick={() => setOpenDropdown(openDropdown === 'services' ? null : 'services')}
              style={{
                background: isActive('/services') || isActive('/major-minor-surgery') || isActive('/dog-grooming') || isActive('/lab-tests') ? '#1BAFBF' : 'none',
                color: isActive('/services') || isActive('/major-minor-surgery') || isActive('/dog-grooming') || isActive('/lab-tests') ? '#fff' : '#4a5568',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '20px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                margin: '6px 0'
              }}
            >
              {t('services')} ▾
            </button>
            {openDropdown === 'services' && (
              <div className="public-nav-dropdown" style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '280px',
                background: '#fff',
                boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
                borderRadius: '10px',
                padding: '10px 0',
                zIndex: 1000,
                border: '1px solid #e2e8f0'
              }}>
                {[
                  { name: t('majorMinorSurgery'), path: '/major-minor-surgery' },
                  { name: t('dogVaccinationPackages'), path: '/dogs-packages' },
                  { name: t('catVaccinationPackages'), path: '/cat-packages' },
                  { name: t('dogGroomingSpa'), path: '/dog-grooming' },
                  { name: `${t('homeVisitConsultation')} (₹599)`, path: '/product/home-visit-consultation' },
                  { name: t('comprehensiveLabTests'), path: '/lab-tests' },
                  { name: `${t('fullHealthCheckup')} (₹999)`, path: '/product/health-checkup' }
                ].map(item => (
                  <div
                    key={item.name}
                    onClick={() => { navigate(item.path); setOpenDropdown(null); }}
                    style={{ padding: '8px 18px', fontSize: '12.5px', color: '#334155', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f0f9fa'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    {item.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contact Us */}
          <button
            onClick={() => navigate('/contact-us')}
            style={{
              background: isActive('/contact-us') ? '#1BAFBF' : 'transparent',
              color: isActive('/contact-us') ? '#fff' : '#4a5568',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '20px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              margin: '6px 0',
              transition: 'all 0.2s'
            }}
          >
            {t('contact')}
          </button>
        </div>
      </nav>
    </header>
  );
};

export default PublicHeader;
