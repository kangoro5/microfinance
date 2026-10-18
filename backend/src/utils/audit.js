const prisma = require('../lib/prisma');

/**
 * Records an immutable audit trail entry. Never throws to the caller's
 * request flow — a failed audit write is logged to console but does not
 * block the underlying business operation, since callers already run
 * inside their own try/catch or transaction.
 */
async function logAction({ actorId, action, entityType, entityId, metadata }) {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, metadata: metadata || undefined },
    });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

module.exports = { logAction };
