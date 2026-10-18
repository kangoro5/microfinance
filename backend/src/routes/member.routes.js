const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { logAction } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// List members: Admin sees only their own; Super Admin sees all (optionally filtered)
router.get('/', requireRole('ADMIN'), async (req, res) => {
  const where = req.user.role === 'SUPER_ADMIN'
    ? (req.query.adminId ? { adminId: req.query.adminId } : {})
    : { adminId: req.user.adminProfile.id };

  const members = await prisma.member.findMany({
    where,
    include: { accounts: { select: { id: true, accountNumber: true, type: true, balance: true, status: true } } },
  });
  res.json(members);
});

// Register a new member — always scoped to the registering Admin
router.post('/', requireRole('ADMIN'), async (req, res) => {
  const { fullName, phone, nationalId, address, nextOfKin, photoUrl, password } = req.body;
  if (!fullName || !phone || !nationalId || !password) {
    return res.status(400).json({ error: 'fullName, phone, nationalId, password are required' });
  }

  // Super Admin registering directly must specify which admin owns this member.
  const adminId = req.user.role === 'SUPER_ADMIN' ? req.body.adminId : req.user.adminProfile.id;
  if (!adminId) return res.status(400).json({ error: 'adminId is required' });

  const [phoneTaken, idTaken] = await Promise.all([
    prisma.member.findUnique({ where: { phone } }),
    prisma.member.findUnique({ where: { nationalId } }),
  ]);
  if (phoneTaken) return res.status(409).json({ error: 'Phone already registered' });
  if (idTaken) return res.status(409).json({ error: 'National ID already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const member = await prisma.member.create({
    data: {
      fullName, phone, nationalId, address, nextOfKin, photoUrl, adminId,
      user: { create: { role: 'MEMBER', passwordHash, name: fullName } },
    },
  });

  await logAction({ actorId: req.user.id, action: 'REGISTER_MEMBER', entityType: 'Member', entityId: member.id });
  res.status(201).json(member);
});

router.get('/:id', requireRole('ADMIN'), async (req, res) => {
  const member = await prisma.member.findUnique({
    where: { id: req.params.id },
    include: { accounts: true },
  });
  if (!member) return res.status(404).json({ error: 'Member not found' });
  if (req.user.role === 'ADMIN' && member.adminId !== req.user.adminProfile.id) {
    return res.status(403).json({ error: "Cannot view another admin's member" });
  }
  res.json(member);
});

module.exports = router;
