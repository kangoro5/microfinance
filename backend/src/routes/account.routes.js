const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole, scopeToAccount } = require('../middleware/rbac');
const { logAction } = require('../utils/audit');
const { notify } = require('../services/notification.service');

const router = express.Router();
router.use(requireAuth);

function generateAccountNumber(type) {
  const prefix = type === 'SAVINGS' ? 'SV' : 'LN';
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${rand}`;
}

// Create an independent account for a member the Admin owns
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { memberId, type, openingBalance = 0, interestRate, frequency, startDate } = req.body;
  if (!memberId || !type || interestRate === undefined || !frequency) {
    return res.status(400).json({ error: 'memberId, type, interestRate, frequency are required' });
  }

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (req.user.role === 'ADMIN' && member.adminId !== req.user.adminProfile.id) {
    return res.status(403).json({ error: "Cannot create an account for another admin's member" });
  }

  let accountNumber = generateAccountNumber(type);
  // Extremely unlikely collision guard
  while (await prisma.account.findUnique({ where: { accountNumber } })) {
    accountNumber = generateAccountNumber(type);
  }

  const account = await prisma.account.create({
    data: {
      accountNumber,
      memberId,
      type,
      openingBalance,
      balance: openingBalance,
      interestRate,
      frequency,
      startDate: startDate ? new Date(startDate) : new Date(),
    },
  });

  if (Number(openingBalance) > 0) {
    await prisma.transaction.create({
      data: {
        accountId: account.id,
        type: 'OPENING_BALANCE',
        amount: openingBalance,
        recordedById: req.user.id,
        balanceAfter: openingBalance,
      },
    });
  }

  await logAction({ actorId: req.user.id, action: 'CREATE_ACCOUNT', entityType: 'Account', entityId: account.id });
  await notify({
    userId: member.userId,
    accountId: account.id,
    title: 'Account opened',
    message: `Your ${type.toLowerCase()} account ${account.accountNumber} has been opened.`,
  });

  res.status(201).json(account);
});

// Change payment frequency — requires a logged reason
router.patch('/:accountId/frequency', requireRole('ADMIN'), scopeToAccount('accountId'), async (req, res) => {
  const { frequency, reason } = req.body;
  if (!frequency || !reason) return res.status(400).json({ error: 'frequency and reason are required' });

  const account = req.targetAccount;
  const updated = await prisma.$transaction(async (tx) => {
    const acc = await tx.account.update({ where: { id: account.id }, data: { frequency } });
    await tx.frequencyChangeLog.create({
      data: {
        accountId: account.id,
        oldFrequency: account.frequency,
        newFrequency: frequency,
        reason,
        changedById: req.user.id,
      },
    });
    return acc;
  });

  await logAction({ actorId: req.user.id, action: 'CHANGE_FREQUENCY', entityType: 'Account', entityId: account.id, metadata: { reason } });
  res.json(updated);
});

// Change status (Active/Suspended/Closed)
router.patch('/:accountId/status', requireRole('ADMIN'), scopeToAccount('accountId'), async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const account = await prisma.account.update({ where: { id: req.targetAccount.id }, data: { status } });
  await logAction({ actorId: req.user.id, action: 'CHANGE_ACCOUNT_STATUS', entityType: 'Account', entityId: account.id, metadata: { status } });

  await notify({
    userId: req.targetAccount.member.userId,
    accountId: account.id,
    title: 'Account status changed',
    message: `Your account ${account.accountNumber} status is now ${status}.`,
  });

  res.json(account);
});

// View a single account (ownership enforced) with its transaction history
router.get('/:accountId', scopeToAccount('accountId'), async (req, res) => {
  const account = await prisma.account.findUnique({
    where: { id: req.targetAccount.id },
    include: { transactions: { orderBy: { createdAt: 'desc' } }, frequencyChanges: true },
  });
  res.json(account);
});

// List accounts visible to the caller
router.get('/', async (req, res) => {
  let where = {};
  if (req.user.role === 'MEMBER') {
    where = { memberId: req.user.memberProfile.id };
  } else if (req.user.role === 'ADMIN') {
    where = { member: { adminId: req.user.adminProfile.id } };
  } else if (req.query.memberId) {
    where = { memberId: req.query.memberId };
  }
  const accounts = await prisma.account.findMany({ where, include: { member: true } });
  res.json(accounts);
});

module.exports = router;
