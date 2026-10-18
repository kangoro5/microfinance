const { verifyToken } = require('../utils/jwt');
const prisma = require('../lib/prisma');

/**
 * Verifies the bearer token, loads the current user (with role-specific
 * profile), and rejects deactivated accounts. Nothing downstream should
 * ever trust a client-supplied role or id — it always comes from here.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { adminProfile: true, memberProfile: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Account not found or deactivated' });
    }

    req.user = user; // { id, role, adminProfile?, memberProfile? }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
