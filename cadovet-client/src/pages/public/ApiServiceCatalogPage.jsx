import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import PublicHero from '../../components/public/PublicHero';
import ProductCard from '../../components/public/ProductCard';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { loadPublicServices, selectCatalogError, selectCatalogStatus, selectServices } from '../../store/catalogSlice';

const ApiServiceCatalogPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToCart, openBookingModal } = useCart();
  const { t } = useLanguage();
  const services = useSelector(selectServices);
  const status = useSelector(selectCatalogStatus);
  const error = useSelector(selectCatalogError);

  useEffect(() => {
    dispatch(loadPublicServices());
  }, [dispatch]);

  return (
    <div className="public-page">
      <PublicHeader />
      <BookingModal />
      <PublicHero
        eyebrow={t('clinics')}
        title={t('services')}
        description={t('catalogDescription')}
      />
      <section className="catalog-section">
        {(status === 'idle' || status === 'loading') && <div className="catalog-state">{t('loadingServices')}</div>}
        {status === 'failed' && <div className="catalog-state">{error || t('servicesUnavailable')}</div>}
        {status === 'succeeded' && services.length === 0 && <div className="catalog-state">{t('noServices')}</div>}
        {status === 'succeeded' && services.length > 0 && (
          <div className="catalog-grid">
            {services.map((service) => (
              <ProductCard
                key={service.id}
                item={service}
                onView={() => navigate(`/product/${service.slug}`)}
                onAddToCart={() => addToCart(service)}
                onBook={() => openBookingModal(service)}
              />
            ))}
          </div>
        )}
      </section>
      <PublicFooter />
    </div>
  );
};

export default ApiServiceCatalogPage;
