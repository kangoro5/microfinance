const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Every role sees only their own notifications
router.get('/', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(notifications);
});

router.post('/:id/read', async (req, res) => {
  const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
  res.json(updated);
});

// Manual trigger for the scheduled jobs — useful for demoing the MVP without waiting for cron
router.post('/run-jobs', async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
  const { runInterestJob } = require('../services/interest.service');
  const { runReminderJob } = require('../services/reminder.service');
  const interest = await runInterestJob();
  const reminders = await runReminderJob();
  res.json({ interest, reminders });
});

module.exports = router;
