import React, { useState } from 'react';

const IdentifierInput = ({ value, onChange, error }) => {
  const [inputType, setInputType] = useState('text');

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (/^\d/.test(val)) {
      setInputType('tel');
    } else {
      setInputType('email');
    }
  };

  const isMobile = /^\d{5,}$/.test(value);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  return (
    <div className="form-group">
      <label className="form-label">
        Email or Mobile Number <span>*</span>
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{
          position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '16px', color: 'var(--primary)'
        }}>
          {isMobile ? '📱' : isEmail ? '✉️' : '👤'}
        </span>
        <input
          type={inputType}
          value={value}
          onChange={handleChange}
          placeholder="user@example.com or 9876543210"
          className={`form-input ${error ? 'error' : ''}`}
          style={{ paddingLeft: '42px' }}
          required
          autoComplete="username"
        />
      </div>
      {error && <div className="error-msg">⚠ {error}</div>}
      {value && !error && (isMobile || isEmail) && (
        <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px', fontWeight: '500' }}>
          ✓ {isMobile ? 'Mobile number' : 'Email address'} detected
        </div>
      )}
    </div>
  );
};

export default IdentifierInput;
