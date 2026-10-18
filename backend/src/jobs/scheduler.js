const cron = require('node-cron');
const { runInterestJob } = require('../services/interest.service');
const { runReminderJob } = require('../services/reminder.service');

/** Wires up the daily scheduled jobs. Called once from src/index.js. */
function startScheduler() {
  // Runs once a day at 01:00 server time — interest posting first, then reminders.
  cron.schedule('0 1 * * *', async () => {
    try {
      const interestResult = await runInterestJob();
      console.log('[scheduler] interest job:', interestResult);
      const reminderResult = await runReminderJob();
      console.log('[scheduler] reminder job:', reminderResult);
    } catch (err) {
      console.error('[scheduler] job failed:', err);
    }
  });
  console.log('[scheduler] daily interest + reminder jobs scheduled for 01:00');
}

module.exports = { startScheduler };
