const PAYMENT_METHOD_OPTIONS = ['MANUAL', 'CASH', 'MOBILE_MONEY', 'MPESA', 'BANK_TRANSFER', 'CARD', 'CHEQUE'];

const PAYMENT_METHOD_ALIASES = {
  MANUAL: 'MANUAL',
  CASH: 'CASH',
  MOBILE_MONEY: 'MOBILE_MONEY',
  MOBILEMONEY: 'MOBILE_MONEY',
  MPESA: 'MPESA',
  'M_PESA': 'MPESA',
  'M-PESA': 'MPESA',
  BANK_TRANSFER: 'BANK_TRANSFER',
  'BANK TRANSFER': 'BANK_TRANSFER',
  CARD: 'CARD',
  CHEQUE: 'CHEQUE',
  CHECK: 'CHEQUE',
};

function normalizePaymentMethod(value) {
  if (value === undefined || value === null || value === '') {
    return 'MANUAL';
  }

  const raw = String(value).trim();
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const mapped = PAYMENT_METHOD_ALIASES[normalized] || PAYMENT_METHOD_ALIASES[raw.toUpperCase()];

  if (mapped && PAYMENT_METHOD_OPTIONS.includes(mapped)) {
    return mapped;
  }

  if (PAYMENT_METHOD_OPTIONS.includes(normalized)) {
    return normalized;
  }

  throw new Error(`Unsupported payment method: ${value}`);
}

module.exports = {
  PAYMENT_METHOD_OPTIONS,
  normalizePaymentMethod,
};
