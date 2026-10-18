/**
 * Mock SMS gateway. Implements the same shape a real provider adapter
 * (Africa's Talking, Twilio) would: an async send(to, message) that
 * resolves to { success, providerRef }. Swap this file's internals for
 * a real HTTP call when going to production — nothing else changes.
 */
async function send(to, message) {
  console.log(`[MOCK SMS] -> ${to}: ${message}`);
  return { success: true, providerRef: `mock-${Date.now()}` };
}

module.exports = { send };
