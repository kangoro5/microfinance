const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Super Admin: global system overview
router.get('/global', async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });

  const [adminCount, memberCount, accounts, transactions] = await Promise.all([
    prisma.admin.count({ where: { user: { isActive: true } } }),
    prisma.member.count(),
    prisma.account.findMany({ select: { balance: true, type: true, status: true } }),
    prisma.transaction.count(),
  ]);

  const totalSavings = accounts.filter((a) => a.type === 'SAVINGS').reduce((s, a) => s + Number(a.balance), 0);
  const totalLoans = accounts.filter((a) => a.type === 'LOAN').reduce((s, a) => s + Number(a.balance), 0);

  res.json({
    adminCount,
    memberCount,
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter((a) => a.status === 'ACTIVE').length,
    totalSavingsBalance: totalSavings,
    totalLoanBalance: totalLoans,
    totalTransactions: transactions,
  });
});

// Admin: portfolio limited to their own members/accounts
router.get('/my-portfolio', async (req, res) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const adminId = req.user.role === 'SUPER_ADMIN' ? req.query.adminId : req.user.adminProfile.id;
  if (!adminId) return res.status(400).json({ error: 'adminId is required' });

  const members = await prisma.member.findMany({
    where: { adminId },
    include: { accounts: true },
  });

  const accounts = members.flatMap((m) => m.accounts);
  res.json({
    memberCount: members.length,
    accountCount: accounts.length,
    totalSavingsBalance: accounts.filter((a) => a.type === 'SAVINGS').reduce((s, a) => s + Number(a.balance), 0),
    totalLoanBalance: accounts.filter((a) => a.type === 'LOAN').reduce((s, a) => s + Number(a.balance), 0),
  });
});

module.exports = router;
