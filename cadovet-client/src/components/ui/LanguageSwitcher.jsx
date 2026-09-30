import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

const LanguageSwitcher = () => {
  const { language, setLanguage, availableLanguages } = useLanguage();

  const handleChange = (event) => {
    const nextLanguage = event.target.value;
    setLanguage(nextLanguage);
    localStorage.setItem('cadovet-language', nextLanguage);
  };

  return (
    <select
      value={language}
      onChange={handleChange}
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        borderRadius: '999px',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer'
      }}
    >
      {availableLanguages.map((code) => (
        <option key={code} value={code}>
          {code.toUpperCase()}
        </option>
      ))}
    </select>
  );
};

export default LanguageSwitcher;
