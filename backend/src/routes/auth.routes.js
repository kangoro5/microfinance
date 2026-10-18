const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

// Public member registration. New members are assigned to the first active admin
// so an administrator can manage the profile after signup.
router.post('/member-register', async (req, res) => {
  const { fullName, phone, nationalId, address, nextOfKin, password } = req.body;
  if (!fullName || !phone || !nationalId || !password) {
    return res.status(400).json({ error: 'fullName, phone, nationalId, password are required' });
  }

  const [phoneTaken, idTaken, admin] = await Promise.all([
    prisma.member.findUnique({ where: { phone } }),
    prisma.member.findUnique({ where: { nationalId } }),
    prisma.admin.findFirst({
      where: { user: { role: 'ADMIN', isActive: true } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  if (phoneTaken) return res.status(409).json({ error: 'Phone already registered' });
  if (idTaken) return res.status(409).json({ error: 'National ID already registered' });
  if (!admin) return res.status(503).json({ error: 'Member registration is unavailable until an active admin exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const member = await prisma.member.create({
    data: {
      fullName, phone, nationalId, address, nextOfKin,
      admin: { connect: { id: admin.id } },
      user: { create: { role: 'MEMBER', passwordHash, name: fullName } },
    },
    include: { user: true },
  });

  await logAction({ actorId: member.user.id, action: 'REGISTER_MEMBER', entityType: 'Member', entityId: member.id });
  res.status(201).json({
    token: signToken(member.user),
    user: {
      id: member.user.id,
      role: 'MEMBER',
      name: member.fullName,
      phone: member.phone,
      memberId: member.id,
    },
  });
});

// SuperAdmin / Admin login (email + password)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = await prisma.user.findUnique({
    where: { email },
    include: { adminProfile: true },
  });
  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.role === 'MEMBER') return res.status(400).json({ error: 'Members must use /auth/member-login' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  await logAction({ actorId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id });

  res.json({
    token: signToken(user),
    user: { id: user.id, role: user.role, name: user.name, email: user.email },
  });
});

// Member login (phone + password). OTP flow is stubbed for a real SMS provider later.
router.post('/member-login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'phone and password required' });

  const member = await prisma.member.findUnique({
    where: { phone },
    include: { user: true },
  });
  if (!member || !member.user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, member.user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  await logAction({ actorId: member.user.id, action: 'LOGIN', entityType: 'User', entityId: member.user.id });

  res.json({
    token: signToken(member.user),
    user: { id: member.user.id, role: 'MEMBER', name: member.fullName, phone: member.phone, memberId: member.id },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const { id, role, name, email, adminProfile, memberProfile } = req.user;
  res.json({ id, role, name, email, adminProfile, memberProfile });
});

module.exports = router;
