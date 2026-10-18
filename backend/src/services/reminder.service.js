const prisma = require('../lib/prisma');
const { notify } = require('./notification.service');
const { computeExpectedAmount } = require('./interest.service');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

/**
 * Scheduled job (daily): for every ACTIVE account, sends a reminder the
 * day before the next expected payment, a reminder on the due date, and
 * a late warning once the due date has passed with no payment.
 */
async function runReminderJob() {
  const accounts = await prisma.account.findMany({
    where: { status: 'ACTIVE' },
    include: { member: { include: { user: true } } },
  });

  const now = new Date();
  const tomorrow = new Date(now.getTime() + MS_PER_DAY);
  let remindersSent = 0;

  for (const account of accounts) {
    const { dueDate, amountDue } = await computeExpectedAmount(account);
    if (!dueDate) continue;

    let title = null;
    let message = null;

    if (isSameDay(dueDate, tomorrow)) {
      title = 'Payment due tomorrow';
      message = `A payment of approximately ${amountDue.toFixed(2)} is due tomorrow on account ${account.accountNumber}.`;
    } else if (isSameDay(dueDate, now)) {
      title = 'Payment due today';
      message = `A payment of approximately ${amountDue.toFixed(2)} is due today on account ${account.accountNumber}.`;
    } else if (dueDate < now) {
      title = 'Late payment warning';
      message = `Account ${account.accountNumber} has a payment overdue since ${dueDate.toDateString()}.`;
    }

    if (title) {
      await notify({ userId: account.member.userId, accountId: account.id, title, message });
      remindersSent++;
    }
  }
  return { accountsChecked: accounts.length, remindersSent };
}

module.exports = { runReminderJob };
