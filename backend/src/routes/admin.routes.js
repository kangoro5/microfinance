const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAction } = require('../utils/audit');

const router = express.Router();
const MAX_ADMINS = 4;

router.use(requireAuth);

// List active admins only (Super Admin only); inactive profiles remain stored for history.
router.get('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  const admins = await prisma.admin.findMany({
    where: { user: { isActive: true } },
    include: { user: true, members: { select: { id: true } } },
  });
  res.json(admins.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    phone: a.phone,
    email: a.user.email,
    isActive: a.user.isActive,
    memberCount: a.members.length,
  })));
});

// Create an admin — capped at exactly 4 active admins
router.post('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'fullName, email, password are required' });
  }

  const activeCount = await prisma.admin.count({ where: { user: { isActive: true } } });
  if (activeCount >= MAX_ADMINS) {
    return res.status(400).json({ error: `Cannot exceed ${MAX_ADMINS} active admins. Deactivate one first.` });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.create({
    data: {
      fullName,
      phone,
      user: { create: { role: 'ADMIN', email, passwordHash, name: fullName } },
    },
    include: { user: true },
  });

  await logAction({ actorId: req.user.id, action: 'CREATE_ADMIN', entityType: 'Admin', entityId: admin.id });
  res.status(201).json({ id: admin.id, fullName: admin.fullName, email: admin.user.email });
});

// Edit an admin's profile
router.patch('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { fullName, phone } = req.body;
  const admin = await prisma.admin.update({
    where: { id: req.params.id },
    data: { fullName, phone },
  });
  await logAction({ actorId: req.user.id, action: 'UPDATE_ADMIN', entityType: 'Admin', entityId: admin.id });
  res.json(admin);
});

// Deactivate (never hard-delete, to preserve audit/history integrity)
router.post('/:id/deactivate', requireRole('SUPER_ADMIN'), async (req, res) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.params.id } });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  await prisma.user.update({ where: { id: admin.userId }, data: { isActive: false } });
  await logAction({ actorId: req.user.id, action: 'DEACTIVATE_ADMIN', entityType: 'Admin', entityId: admin.id });
  res.json({ ok: true });
});

router.post('/:id/reactivate', requireRole('SUPER_ADMIN'), async (req, res) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.params.id } });
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const activeCount = await prisma.admin.count({ where: { user: { isActive: true } } });
  if (activeCount >= MAX_ADMINS) {
    return res.status(400).json({ error: `Cannot exceed ${MAX_ADMINS} active admins.` });
  }

  await prisma.user.update({ where: { id: admin.userId }, data: { isActive: true } });
  await logAction({ actorId: req.user.id, action: 'REACTIVATE_ADMIN', entityType: 'Admin', entityId: admin.id });
  res.json({ ok: true });
});

module.exports = router;
