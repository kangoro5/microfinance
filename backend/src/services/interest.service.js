const prisma = require('../lib/prisma');
const { notify } = require('./notification.service');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function periodDays(frequency) {
  if (frequency === 'DAILY') return 1;
  if (frequency === 'WEEKLY') return 7;
  return 30; // MONTHLY (simplified for MVP)
}

/**
 * Simple interest for one period: principal * (annualRatePercent/100) * (periodDays/365).
 * Runs once per elapsed period since the account's last interest posting
 * (or startDate if none yet).
 */
function simpleInterestForPeriod(principal, annualRatePercent, days) {
  return Number(principal) * (Number(annualRatePercent) / 100) * (days / 365);
}

/** Figures out the next due date and amount for reminders/late detection. */
async function computeExpectedAmount(account) {
  const days = periodDays(account.frequency);
  const lastTxn = await prisma.transaction.findFirst({
    where: { accountId: account.id, type: { in: ['PAYMENT', 'OPENING_BALANCE'] } },
    orderBy: { createdAt: 'desc' },
  });
  const base = lastTxn ? lastTxn.createdAt : account.startDate;
  const dueDate = new Date(base.getTime() + days * MS_PER_DAY);
  const amountDue = simpleInterestForPeriod(account.balance, account.interestRate, days) || 0;
  return { dueDate, amountDue };
}

/**
 * Scheduled job (daily): for every ACTIVE account whose period has
 * elapsed since the last interest posting, post one interest
 * transaction (credit for SAVINGS, charge for LOAN) and notify the
 * member. Designed to be idempotent per period by checking the last
 * INTEREST_* transaction's date.
 */
async function runInterestJob() {
  const accounts = await prisma.account.findMany({
    where: { status: 'ACTIVE' },
    include: { member: { include: { user: true } } },
  });

  let posted = 0;
  for (const account of accounts) {
    const days = periodDays(account.frequency);
    const lastInterest = await prisma.transaction.findFirst({
      where: { accountId: account.id, type: { in: ['INTEREST_CREDIT', 'INTEREST_CHARGE'] } },
      orderBy: { createdAt: 'desc' },
    });
    const since = lastInterest ? lastInterest.createdAt : account.startDate;
    const elapsedDays = (Date.now() - since.getTime()) / MS_PER_DAY;
    if (elapsedDays < days) continue; // period not elapsed yet

    const interestAmount = simpleInterestForPeriod(account.balance, account.interestRate, days);
    if (interestAmount <= 0) continue;

    const isSavings = account.type === 'SAVINGS';
    const newBalance = isSavings
      ? Number(account.balance) + interestAmount
      : Number(account.balance) + interestAmount; // loan interest increases amount owed

    await prisma.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          accountId: account.id,
          type: isSavings ? 'INTEREST_CREDIT' : 'INTEREST_CHARGE',
          amount: interestAmount,
          recordedById: 'SYSTEM',
          balanceAfter: newBalance,
        },
      });
      await tx.account.update({ where: { id: account.id }, data: { balance: newBalance } });
    });

    await notify({
      userId: account.member.userId,
      accountId: account.id,
      title: isSavings ? 'Interest credited' : 'Interest charged',
      message: `${isSavings ? 'Interest of' : 'Loan interest of'} ${interestAmount.toFixed(2)} was ${isSavings ? 'credited to' : 'charged on'} account ${account.accountNumber}.`,
    });
    posted++;
  }
  return { accountsChecked: accounts.length, interestPosted: posted };
}

module.exports = { simpleInterestForPeriod, computeExpectedAmount, runInterestJob, periodDays };
