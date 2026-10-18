const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { scopeToAccount } = require('../middleware/rbac');
const { logAction } = require('../utils/audit');
const { notify } = require('../services/notification.service');
const { computeExpectedAmount } = require('../services/interest.service');
const { normalizePaymentMethod } = require('../utils/paymentMethods');

const router = express.Router();
router.use(requireAuth);

/**
 * Record a payment. Only two initiators are allowed by role:
 * - MEMBER paying into their own account
 * - ADMIN recording a payment on behalf of a member THEY manage
 * There is no "offline" flag — every payment is created here, so every
 * payment always produces an immutable Transaction row.
 */
router.post('/:accountId', scopeToAccount('accountId'), async (req, res) => {
  const { amount } = req.body;
  const account = req.targetAccount;

  if (req.user.role === 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super Admin does not record payments directly' });
  }
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be positive' });
  if (account.status !== 'ACTIVE') return res.status(400).json({ error: 'Account is not active' });

  let method;
  try {
    method = normalizePaymentMethod(req.body.method);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const reference = typeof req.body.reference === 'string' ? req.body.reference.trim() : undefined;
  const expected = await computeExpectedAmount(account);
  const isPartial = expected != null && Number(amount) < expected.amountDue;
  const isLate = expected != null && expected.dueDate && new Date() > expected.dueDate;

  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.account.findUnique({ where: { id: account.id } });
    const newBalance = account.type === 'LOAN'
      ? Number(fresh.balance) - Number(amount) // payment reduces loan balance owed
      : Number(fresh.balance) + Number(amount); // payment increases savings balance

    const txn = await tx.transaction.create({
      data: {
        accountId: account.id,
        type: 'PAYMENT',
        amount,
        method,
        reference,
        isPartial,
        isLate,
        expectedDate: expected?.dueDate || null,
        recordedById: req.user.id,
        balanceAfter: newBalance,
      },
    });

    await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });
    return txn;
  });

  await logAction({
    actorId: req.user.id,
    action: 'RECORD_PAYMENT',
    entityType: 'Transaction',
    entityId: result.id,
    metadata: { accountId: account.id, amount, method },
  });

  await notify({
    userId: account.member.userId,
    accountId: account.id,
    title: 'Payment received',
    message: `A payment of ${amount} was recorded on account ${account.accountNumber}.${isPartial ? ' (Partial payment)' : ''}${isLate ? ' (Late)' : ''}`,
  });

  res.status(201).json(result);
});

// Full transaction history for an account (with filters)
router.get('/:accountId/history', scopeToAccount('accountId'), async (req, res) => {
  const { type, from, to } = req.query;
  const where = { accountId: req.targetAccount.id };
  if (type) where.type = type;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  const transactions = await prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(transactions);
});

module.exports = router;
