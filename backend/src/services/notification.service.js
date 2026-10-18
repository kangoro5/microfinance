const prisma = require('../lib/prisma');
const sms = require('./sms.mock');

/**
 * Sends a personal notification to a single user: writes an in-app
 * notification record and fires the (mocked) SMS channel. Failures in
 * the SMS leg are logged but never block the in-app record or the
 * caller's main transaction — notifications are best-effort.
 */
async function notify({ userId, accountId = null, title, message, phone = null }) {
  const record = await prisma.notification.create({
    data: { userId, accountId, title, message, channel: 'IN_APP' },
  });

  if (phone) {
    try {
      await sms.send(phone, `${title}: ${message}`);
      await prisma.notification.create({
        data: { userId, accountId, title, message, channel: 'SMS' },
      });
    } catch (err) {
      console.error('SMS notification failed:', err.message);
    }
  }

  return record;
}

module.exports = { notify };
