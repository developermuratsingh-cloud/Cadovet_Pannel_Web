import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { useCart } from '../../context/CartContext';
import { getProductBySlug, getAllProducts } from '../../constants/cadovetCatalog';
import { loadPublicServices, selectServices } from '../../store/catalogSlice';

const ProductDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToCart, openBookingModal } = useCart();
  const [qty, setQty] = useState(1);
  const liveServices = useSelector(selectServices);

  useEffect(() => {
    dispatch(loadPublicServices());
  }, [dispatch]);

  // A service created on the admin Services & Fees page (not one of the curated packages below) has no entry
  // in the static catalog — its slug only exists in the live `services` table, so look there next.
  const staticProduct = getProductBySlug(slug);
  const liveService = !staticProduct ? liveServices.find((s) => s.slug === slug) : null;
  const product = staticProduct || (liveService && {
    ...liveService,
    title: liveService.title || liveService.name,
    subtitle: liveService.category,
    shortDesc: liveService.shortDesc || liveService.description || 'Professional veterinary care for your pet.',
    price: Number(liveService.price) || 0,
    inclusions: [],
  }) || getAllProducts()[0];
  const related = getAllProducts().filter(p => p.slug !== product.slug && p.category === product.category).slice(0, 3);

  const handleAddToCartWithQty = () => {
    for (let i = 0; i < qty; i++) {
      addToCart(product);
    }
  };

  return (
    <div className="public-page" style={{ fontFamily: 'Poppins, sans-serif', color: '#1e293b', background: '#fff', minHeight: '100vh' }}>
      <PublicHeader />
      <BookingModal />

      {/* Breadcrumbs */}
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '24px 20px 0', fontSize: '13px', color: '#64748b' }}>
        <span style={{ cursor: 'pointer', color: '#1BAFBF' }} onClick={() => navigate('/')}>Home</span> &gt;{' '}
        <span style={{ cursor: 'pointer', color: '#1BAFBF' }} onClick={() => navigate(product.category === 'Cat' ? '/cat-packages' : '/dogs-packages')}>{product.category}</span> &gt;{' '}
        <strong>{product.title}</strong>
      </div>

      {/* Main Product Layout */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '30px 20px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '50px', alignItems: 'start' }}>
          {/* Left Column: Image Box */}
          <div style={{
            background: '#f8fafc',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            {product.badge && (
              <span style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: '#84cc16',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '800',
                textTransform: 'uppercase'
              }}>
                {product.badge}
              </span>
            )}
            <img
              src={product.image}
              alt={product.title}
              style={{ width: '85%', maxHeight: '380px', objectFit: 'contain' }}
            />
          </div>

          {/* Right Column: Details & Actions */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1BAFBF', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.8px' }}>
              {product.subtitle || product.category}
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', margin: '0 0 12px 0', lineHeight: 1.2 }}>
              {product.title}
            </h1>

            {/* Reviews */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <span style={{ color: '#f59e0b', fontSize: '15px' }}>★★★★★</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>5.0</span>
              <span style={{ fontSize: '13px', color: '#64748b' }}>({product.reviewsCount || 35} customer reviews)</span>
            </div>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '24px' }}>
              <span style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a' }}>
                ₹{product.price.toLocaleString()}.00
              </span>
              {product.originalPrice && (
                <span style={{ fontSize: '18px', color: '#94a3b8', textDecoration: 'line-through' }}>
                  ₹{product.originalPrice.toLocaleString()}.00
                </span>
              )}
              {product.originalPrice && (
                <span style={{ background: '#fef2f2', color: '#ef4444', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                  Save ₹{(product.originalPrice - product.price).toLocaleString()}
                </span>
              )}
            </div>

            {/* Description */}
            <p style={{ fontSize: '14.5px', color: '#475569', lineHeight: '1.7', marginBottom: '24px' }}>
              {product.shortDesc}
            </p>

            {/* What is Included Checklist */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                What’s Included in this Doorstep Package:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13.5px', color: '#334155', lineHeight: '1.8' }}>
                {product.inclusions && product.inclusions.map((inc, i) => (
                  <li key={i}>{inc}</li>
                ))}
              </ul>
            </div>

            {/* Quantity Selector & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
              {/* Qty Box */}
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  style={{ background: '#f1f5f9', border: 'none', padding: '10px 16px', fontSize: '16px', cursor: 'pointer', fontWeight: '700' }}
                >
                  −
                </button>
                <span style={{ padding: '0 16px', fontSize: '15px', fontWeight: '800' }}>{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  style={{ background: '#f1f5f9', border: 'none', padding: '10px 16px', fontSize: '16px', cursor: 'pointer', fontWeight: '700' }}
                >
                  +
                </button>
              </div>

              {/* Add to Cart */}
              <button
                onClick={handleAddToCartWithQty}
                style={{
                  background: '#f8fafc',
                  color: '#0f172a',
                  border: '2px solid #0f172a',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                🛒 Add to Cart
              </button>

              {/* Book Home Visit */}
              <button
                onClick={() => openBookingModal(product)}
                style={{
                  background: 'linear-gradient(135deg, #1BAFBF, #066aab)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(27,175,191,0.3)'
                }}
              >
                Book Home Visit Now
              </button>
            </div>

            {/* Quick Guarantees */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#64748b' }}>
              <div>✓ <strong>Doorstep Service:</strong> Available across Delhi, Noida, Greater Noida & Ghaziabad</div>
              <div>✓ <strong>Licensed Doctors:</strong> BVSc & AH registered veterinarians</div>
              <div>✓ <strong>Cold Chain:</strong> Guaranteed 2°C - 8°C vaccine cold-chain maintained</div>
              <div>✓ <strong>Digital Records:</strong> Official health card saved to your Cadovet account</div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div style={{ marginTop: '70px', borderTop: '1px solid #e2e8f0', paddingTop: '50px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '24px' }}>
              Frequently Paired With This Service
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              {related.map(rel => (
                <div
                  key={rel.slug}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/product/${rel.slug}`)}
                >
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <img src={rel.image} alt={rel.title} style={{ maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>{rel.title}</h4>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#1BAFBF' }}>₹{rel.price}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  );
};

export default ProductDetailPage;
