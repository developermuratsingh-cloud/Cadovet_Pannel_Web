import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        borderRadius: '999px',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
      {theme === 'dark' ? t('light') : t('dark')}
    </button>
  );
};

export default ThemeToggle;
