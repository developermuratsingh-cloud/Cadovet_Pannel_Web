// The emergency-hours rule and price selection: pure functions, no database or HTTP needed.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isEmergencyTime, isEmergencyMinutes, effectivePrice } = require('../src/utils/emergency');

describe('emergency hours (9 PM up to, not including, 9 AM)', () => {
  it('treats the evening, the night and the early morning as emergency', () => {
    for (const t of ['09:00 PM', '10:00 PM', '11:30 PM', '12:00 AM', '12:30 AM', '01:00 AM', '05:00 AM', '08:00 AM', '08:59 AM']) {
      assert.equal(isEmergencyTime(t), true, t);
    }
  });
  it('treats 9:00 AM through 8:59 PM as ordinary', () => {
    for (const t of ['09:00 AM', '09:30 AM', '12:00 PM', '03:00 PM', '08:00 PM', '08:59 PM']) {
      assert.equal(isEmergencyTime(t), false, t);
    }
  });
  it('accepts spellings the slot parser accepts', () => {
    assert.equal(isEmergencyTime(' 9:00 pm '), true);
    assert.equal(isEmergencyTime('8:00 am'), true);
    assert.equal(isEmergencyTime('9:00 am'), false);
  });
  it('judges a window by when it starts', () => {
    assert.equal(isEmergencyTime('10:00 PM to 12:00 AM'), true);
    assert.equal(isEmergencyTime('06:00 AM to 08:00 AM'), true);
    assert.equal(isEmergencyTime('09:00 AM to 11:00 AM'), false);
    assert.equal(isEmergencyTime('06:00 PM to 08:00 PM'), false);
    assert.equal(isEmergencyTime('08:00 PM to 10:00 PM'), false); // starts in ordinary hours
  });
  it('does not guess for garbage', () => {
    for (const t of ['Not decided', '', null, undefined, '25:00 PM', 42, '10:00 PM until midnight']) {
      assert.equal(isEmergencyTime(t), false, String(t));
    }
  });
  it('works on minutes since midnight too', () => {
    assert.equal(isEmergencyMinutes(0), true);
    assert.equal(isEmergencyMinutes(9 * 60 - 1), true);
    assert.equal(isEmergencyMinutes(9 * 60), false);
    assert.equal(isEmergencyMinutes(21 * 60 - 1), false);
    assert.equal(isEmergencyMinutes(21 * 60), true);
    assert.equal(isEmergencyMinutes(null), false);
  });
});

describe('effectivePrice', () => {
  const svc = { price: '500.00', emergency_price: '900.00' };
  it('uses the emergency price only for an emergency visit', () => {
    assert.equal(effectivePrice(svc, true), 900);
    assert.equal(effectivePrice(svc, false), 500);
  });
  it('falls back to the normal price when no emergency price is set', () => {
    assert.equal(effectivePrice({ price: 500, emergency_price: null }, true), 500);
    assert.equal(effectivePrice({ price: 500 }, true), 500);
  });
  it('honours an emergency price of zero', () => {
    assert.equal(effectivePrice({ price: 500, emergency_price: 0 }, true), 0);
  });
});
