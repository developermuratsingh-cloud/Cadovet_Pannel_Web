import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

const ProductCard = ({ item, onView, onAddToCart, onBook, inclusions = [] }) => {
  const { t } = useLanguage();

  return (
    <article className="product-card">
    <button type="button" className="product-card__media" onClick={onView} aria-label={`View ${item.title}`}>
      {item.badge && <span className="product-card__badge">{item.badge}</span>}
      <img src={item.image} alt={item.title} />
    </button>

    <div className="product-card__body">
      <div>
        <span className="product-card__category">{item.subtitle || item.category || 'Pet healthcare'}</span>
        <h3>{item.title}</h3>
        <div className="product-card__rating" aria-label={`${item.rating || 5} out of 5 stars`}>
          <span>★★★★★</span>
          <small>({item.reviewsCount || 0} reviews)</small>
        </div>
        <p>{item.shortDesc || item.description || 'Professional veterinary care for your pet.'}</p>
        {inclusions.length > 0 && (
          <div className="product-card__inclusions">
            <strong>Includes</strong>
            <ul>
              {inclusions.slice(0, 3).map((inclusion) => <li key={inclusion}>{inclusion}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className="product-card__price">₹{Number(item.price || 0).toLocaleString()}</div>
        <div className="product-card__actions">
          <button type="button" className="btn-card-secondary" onClick={onAddToCart}>{t('addToCart')}</button>
          <button type="button" className="btn-card-primary" onClick={onBook}>{t('bookVisit')}</button>
        </div>
      </div>
    </div>
  </article>
  );
};

export default ProductCard;
