import React from 'react';

const SectionHeader = ({ eyebrow, title, subtitle, align = 'center' }) => (
  <div style={{ textAlign: align, marginBottom: '40px' }}>
    {eyebrow && (
      <span style={{
        display: 'inline-block',
        fontSize: '12px',
        fontWeight: '800',
        color: '#1BAFBF',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '8px'
      }}>
        {eyebrow}
      </span>
    )}
    <h2 style={{ fontSize: '32px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '4px', marginBottom: '8px' }}>
      {title}
    </h2>
    {subtitle && (
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
        {subtitle}
      </p>
    )}
  </div>
);

export default SectionHeader;
