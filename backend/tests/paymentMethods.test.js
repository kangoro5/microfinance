const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePaymentMethod, PAYMENT_METHOD_OPTIONS } = require('../src/utils/paymentMethods');

test('normalizes common payment methods to supported enum values', () => {
  assert.equal(normalizePaymentMethod('cash'), 'CASH');
  assert.equal(normalizePaymentMethod('mobile money'), 'MOBILE_MONEY');
  assert.equal(normalizePaymentMethod('mpesa'), 'MPESA');
  assert.equal(normalizePaymentMethod('m-pesa'), 'MPESA');
  assert.equal(normalizePaymentMethod('bank transfer'), 'BANK_TRANSFER');
  assert.equal(normalizePaymentMethod('manual'), 'MANUAL');
});

test('rejects unsupported payment methods', () => {
  assert.throws(() => normalizePaymentMethod('paypal'), /unsupported payment method/i);
});

test('exposes the allowed payment methods for UI usage', () => {
  assert.deepEqual(PAYMENT_METHOD_OPTIONS, ['MANUAL', 'CASH', 'MOBILE_MONEY', 'MPESA', 'BANK_TRANSFER', 'CARD', 'CHEQUE']);
});
