import React from 'react';

const PublicHero = ({ eyebrow, title, description }) => (
  <section className="public-hero">
    <div className="public-hero__inner">
      <span className="public-hero__eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  </section>
);

export default PublicHero;
