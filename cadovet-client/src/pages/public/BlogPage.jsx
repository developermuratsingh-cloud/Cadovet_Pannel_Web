import React, { useState } from 'react';
import PublicHeader from '../../components/public/PublicHeader';
import PublicFooter from '../../components/public/PublicFooter';
import BookingModal from '../../components/public/BookingModal';
import { BLOG_POSTS } from '../../constants/cadovetCatalog';
import { useLanguage } from '../../context/LanguageContext';

const BlogPage = () => {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [readingArticle, setReadingArticle] = useState(null);
  const { t } = useLanguage();

  const categories = ['ALL', 'Pet Health', 'Emergency Care', 'Surgery & Wellness', 'Grooming', 'Preventive Medicine', 'Nutrition', 'Behavior & Training'];
  const categoryLabels = {
    'Pet Health': t('petHealthCategory'),
    'Emergency Care': t('emergencyCareCategory'),
    'Surgery & Wellness': t('surgeryWellnessCategory'),
    Grooming: t('grooming'),
    'Preventive Medicine': t('preventiveMedicineCategory'),
    Nutrition: t('nutritionCategory'),
    'Behavior & Training': t('behaviorTrainingCategory')
  };
  const localizedPost = (post) => ({
    ...post,
    title: t(`blogPost${post.id}Title`),
    excerpt: t(`blogPost${post.id}Excerpt`)
  });

  const filteredPosts = selectedCategory === 'ALL'
    ? BLOG_POSTS
    : BLOG_POSTS.filter(p => p.category.toLowerCase().includes(selectedCategory.toLowerCase()));

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
            {t('healthWellnessJournal')}
          </div>
          <h1 style={{ fontSize: '36px', fontWeight: '900', margin: '0 0 14px 0' }}>
            {t('blogTitle')}
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.95, margin: 0 }}>
            {t('blogDescription')}
          </p>
        </div>
      </section>

      {/* Category Filter Pills */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '30px 20px 10px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? '#1BAFBF' : '#f1f5f9',
                color: selectedCategory === cat ? '#fff' : '#475569',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {cat === 'ALL' ? t('allArticles') : categoryLabels[cat]}
            </button>
          ))}
        </div>
      </section>

      {/* Articles Grid */}
      <section style={{ maxWidth: '1240px', margin: '0 auto', padding: '20px 20px 80px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '30px'
        }}>
          {filteredPosts.map(post => {
            const localized = localizedPost(post);
            return (
            <div
              key={post.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer'
              }}
              onClick={() => setReadingArticle(post)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.03)';
              }}
            >
              <div style={{ position: 'relative', height: '220px', overflow: 'hidden', background: '#f8fafc' }}>
                <img
                  src={post.image}
                  alt={localized.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: '#1BAFBF',
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase'
                }}>
                  {categoryLabels[post.category] || post.category}
                </span>
              </div>

              <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span>✍️ {post.author}</span>
                    <span>•</span>
                    <span>{post.date}</span>
                    <span>•</span>
                    <span>⏱️ {post.readTime}</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', lineHeight: 1.4, margin: '0 0 12px 0' }}>
                    {localized.title}
                  </h3>
                  <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.7, margin: 0 }}>
                    {localized.excerpt}
                  </p>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#1BAFBF', fontWeight: '700', fontSize: '13.5px' }}>
                    {t('readArticle')} →
                  </span>
                  <span style={{ fontSize: '12px', color: '#84cc16', fontWeight: '700' }}>
                    {t('verifiedByVet')}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* Article Reader Modal */}
      {readingArticle && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '780px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'sticky',
              top: 0,
              background: '#fff',
              zIndex: 10
            }}>
              <div>
                <span style={{ background: '#e0f4f7', color: '#066aab', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>
                  {categoryLabels[readingArticle.category] || readingArticle.category}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '12px' }}>
                  {t('by')} {readingArticle.author} • {readingArticle.date}
                </span>
              </div>
              <button
                onClick={() => setReadingArticle(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 30px' }}>
              <img
                src={readingArticle.image}
                alt={localizedPost(readingArticle).title}
                style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', borderRadius: '12px', marginBottom: '24px' }}
              />
              <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', lineHeight: 1.3, marginBottom: '20px' }}>
                {localizedPost(readingArticle).title}
              </h2>
              <div style={{ fontSize: '15px', lineHeight: '1.9', color: '#334155', whiteSpace: 'pre-line' }}>
                {readingArticle.content}
              </div>

              {/* Consultation CTA */}
              <div style={{
                marginTop: '36px',
                padding: '24px',
                background: 'linear-gradient(135deg, #f0f9fa, #e0f4f7)',
                borderRadius: '12px',
                border: '1px solid #b8e2e6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#066aab' }}>
                    {t('needAdvice')}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                    {t('bookCheckup')}
                  </p>
                </div>
                <a
                  href="tel:+919220410777"
                  style={{
                    background: '#1BAFBF',
                    color: '#fff',
                    padding: '10px 20px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '700',
                    textDecoration: 'none'
                  }}
                >
                  📞 {t('callNow')} +91 922 041 0777
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  );
};

export default BlogPage;
