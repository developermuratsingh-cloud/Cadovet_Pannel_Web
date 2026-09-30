import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import PublicHero from '../../components/public/PublicHero';
import ProductCard from '../../components/public/ProductCard';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { loadPublicServicesByCategory, selectCategoryCatalogError, selectCategoryCatalogStatus, selectServices } from '../../store/catalogSlice';

// Live from the Services & Fees table — 'Dogs'/'Cats' are real categories there now, so whatever Operational
// Head/Admin adds, edits or deactivates in the panel is exactly what shows here. (This used to ask for a
// 'Preventive Care' category that never existed, so both pages always rendered empty — see the Services &
// Fees migration that added the species-specific categories.)
const ApiPackageCatalogPage = ({ species }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { addToCart, openBookingModal } = useCart();
  const { t } = useLanguage();
  const catalogServices = useSelector(selectServices);
  const status = useSelector(selectCategoryCatalogStatus);
  const error = useSelector(selectCategoryCatalogError);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    dispatch(loadPublicServicesByCategory(species === 'Dog' ? 'Dogs' : 'Cats'));
  }, [dispatch, species]);

  const filtered = filter === 'ALL'
    ? catalogServices
    : filter === 'BUNDLES'
      ? catalogServices.filter((service) => Number(service.price) > 3000)
      : catalogServices.filter((service) => Number(service.price) <= 3000);

  return (
    <div className="public-page">
      <PublicHeader />
      <BookingModal />
      <PublicHero
        eyebrow={species === 'Dog' ? t('veterinaryPreventiveCare') : t('felineHomeCare')}
        title={species === 'Dog' ? t('dogPackagesTitle') : t('catPackagesTitle')}
        description={t('catalogDescription')}
      />
      <section className="catalog-section">
        <div className="catalog-toolbar">
          <div className="breadcrumb" onClick={() => navigate('/')}>{t('home')} <span>›</span> {species} Vaccinations ({filtered.length})</div>
          {species === 'Dog' && (
            <div className="catalog-filters">
              {[['ALL', t('allCare')], ['BUNDLES', t('completeBundles')], ['SINGLE', t('singleServices')]].map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'filter-button active' : 'filter-button'} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
          )}
        </div>
        {(status === 'idle' || status === 'loading') && <div className="catalog-state">{t('loadingServices')}</div>}
        {status === 'failed' && <div className="catalog-state">{error || t('servicesUnavailable')}</div>}
        {status === 'succeeded' && filtered.length === 0 && <div className="catalog-state">{t('noServices')}</div>}
        {status === 'succeeded' && filtered.length > 0 && (
          <div className="catalog-grid">
            {filtered.map((service) => (
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

export default ApiPackageCatalogPage;
