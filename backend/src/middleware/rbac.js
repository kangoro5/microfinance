const prisma = require('../lib/prisma');

/** Restricts a route to one or more roles. Super Admin is never restricted by this. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.user.role === 'SUPER_ADMIN') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden for this role' });
    }
    next();
  };
}

/**
 * Loads the target account and enforces ownership:
 * - SUPER_ADMIN: any account
 * - ADMIN: only accounts belonging to members THEY registered
 * - MEMBER: only their own accounts
 * Attaches the account (with member) to req.targetAccount.
 */
function scopeToAccount(paramName = 'accountId') {
  return async (req, res, next) => {
    const accountId = req.params[paramName] || req.body[paramName];
    if (!accountId) return res.status(400).json({ error: `${paramName} is required` });

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { member: true },
    });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    if (req.user.role === 'SUPER_ADMIN') {
      req.targetAccount = account;
      return next();
    }
    if (req.user.role === 'ADMIN') {
      if (account.member.adminId !== req.user.adminProfile.id) {
        return res.status(403).json({ error: "Cannot access another admin's member accounts" });
      }
      req.targetAccount = account;
      return next();
    }
    if (req.user.role === 'MEMBER') {
      if (account.memberId !== req.user.memberProfile.id) {
        return res.status(403).json({ error: 'Cannot access another member\'s account' });
      }
      req.targetAccount = account;
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  };
}

module.exports = { requireRole, scopeToAccount };
