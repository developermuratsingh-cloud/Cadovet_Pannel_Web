import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { useCart } from '../../context/CartContext';
import { loadPublicServicesByCategory, selectServices } from '../../store/catalogSlice';

// Live from Services & Fees (category "Lab Tests") — same fields (subtitle, inclusions, sale price) the
// panel now manages, instead of a hardcoded copy that could drift from what's actually offered.
const LabTestsPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToCart, openBookingModal } = useCart();
  const LAB_TESTS = useSelector(selectServices);

  useEffect(() => {
    dispatch(loadPublicServicesByCategory('Lab Tests'));
  }, [dispatch]);

  return (
    <div className="public-page" style={{ fontFamily: 'Poppins, sans-serif', color: '#1e293b', background: '#fff', minHeight: '100vh' }}>
      <PublicHeader />
      <BookingModal />

      {/* Hero Header */}
      <section style={{
        background: 'linear-gradient(135deg, #0d9aaa 0%, #1BAFBF 100%)',
        color: '#fff',
        padding: '60px 20px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(255,255,255,0.2)',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '12.5px',
            fontWeight: '700',
            marginBottom: '14px',
            letterSpacing: '1px'
          }}>
            PRECISION VETERINARY DIAGNOSTICS
          </div>
          <h1 style={{ fontSize: '38px', fontWeight: '900', margin: '0 0 14px 0' }}>
            In-Home Pet Diagnostic Lab Tests
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.95, margin: 0, lineHeight: 1.6 }}>
            Accurate blood work, viral antigen panels, biopsy pathology, and tick fever diagnostics collected painlessly at your home with rapid digital report delivery.
          </p>
        </div>
      </section>

      {/* Breadcrumb Bar */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 10px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <span style={{ cursor: 'pointer', color: '#1BAFBF' }} onClick={() => navigate('/')}>Home</span> &gt; <strong>Lab Tests</strong> ({LAB_TESTS.length} Diagnostic Tests)
        </div>
      </section>

      {/* Lab Highlights & Authentic Photo */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px 20px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#1BAFBF', fontWeight: '800', fontSize: '13px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
              NABL ACCREDITED DIAGNOSTICS
            </div>
            <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', marginBottom: '16px', lineHeight: 1.3 }}>
              Doorstep Blood Collection & Automated Lab Testing
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '1.8', color: '#475569', marginBottom: '20px' }}>
              Skip the stress of transporting an anxious or unwell pet to a clinic. Our certified phlebotomists arrive at your home with gentle handling techniques, sterile vacutainers, and refrigerated transport boxes to maintain the biological integrity of every sample.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#84cc16', fontWeight: '900', fontSize: '16px' }}>✔</span>
                <span>Painless, stress-free sample collection at your residence</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#84cc16', fontWeight: '900', fontSize: '16px' }}>✔</span>
                <span>Same-day reports for CBC, KFT, LFT and Glucose panels</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#84cc16', fontWeight: '900', fontSize: '16px' }}>✔</span>
                <span>Consultation with senior veterinary pathologist included</span>
              </div>
            </div>
          </div>

          <div>
            <img
              src="https://cadovet.com/wp-content/uploads/2024/12/woman-working-laboratory-close-up-1024x807.jpg"
              alt="Veterinary laboratory testing Cadovet"
              style={{ width: '100%', borderRadius: '16px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', objectFit: 'cover', maxHeight: '360px' }}
            />
          </div>
        </div>
      </section>

      {/* Tests Grid */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '10px 20px 80px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '26px'
        }}>
          {LAB_TESTS.map(test => (
            <div
              key={test.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                overflow: 'hidden',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
              }}
            >
              {/* Badge */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: '#1BAFBF',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '800',
                zIndex: 2,
                textTransform: 'uppercase'
              }}>
                {test.badge}
              </div>

              {/* Image */}
              <div
                style={{ height: '180px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                onClick={() => navigate(`/product/${test.slug}`)}
              >
                <img src={test.image} alt={test.title} style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
              </div>

              {/* Body */}
              <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1BAFBF', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {test.subtitle}
                  </div>
                  <h3
                    onClick={() => navigate(`/product/${test.slug}`)}
                    style={{ fontSize: '16.5px', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0', cursor: 'pointer', lineHeight: 1.3 }}
                  >
                    {test.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', margin: '0 0 14px 0' }}>
                    {test.shortDesc}
                  </p>

                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', color: '#334155', marginBottom: '16px' }}>
                    <div style={{ fontWeight: '700', marginBottom: '6px', color: '#0f172a' }}>Parameters Tested:</div>
                    <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.6' }}>
                      {test.inclusions.map((inc, i) => (
                        <li key={i}>{inc}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
                      ₹{test.price.toLocaleString()}
                    </span>
                    {test.originalPrice && (
                      <span style={{ fontSize: '13px', color: '#94a3b8', textDecoration: 'line-through' }}>
                        ₹{test.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      onClick={() => addToCart(test)}
                      style={{
                        background: '#f1f5f9',
                        color: '#1e293b',
                        border: '1px solid #cbd5e1',
                        padding: '9px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      🛒 Add to Cart
                    </button>

                    <button
                      onClick={() => openBookingModal(test)}
                      style={{
                        background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
                        color: '#fff',
                        border: 'none',
                        padding: '9px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Book Sample
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Report Timeline Banner */}
      <section style={{ background: '#f8fafc', padding: '50px 20px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '10px' }}>
            Seamless Digital Reports via WhatsApp & Your Account
          </h3>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.7 }}>
            All collected samples are analyzed in NABL-accredited diagnostic centers. Digital lab reports are uploaded directly to your Cadovet account and sent via WhatsApp within 4 to 24 hours.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default LabTestsPage;
