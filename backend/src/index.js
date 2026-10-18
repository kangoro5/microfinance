require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const prisma = require('./lib/prisma');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const memberRoutes = require('./routes/member.routes');
const accountRoutes = require('./routes/account.routes');
const paymentRoutes = require('./routes/payment.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportRoutes = require('./routes/report.routes');
const { startScheduler } = require('./jobs/scheduler');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/admins', adminRoutes);
app.use('/members', memberRoutes);
app.use('/accounts', accountRoutes);
app.use('/payments', paymentRoutes);
app.use('/notifications', notificationRoutes);
app.use('/reports', reportRoutes);

// Central error handler — never leak stack traces to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    const topology = await prisma.$runCommandRaw({ hello: 1 });
    if (!topology.setName || !topology.isWritablePrimary) {
      throw new Error('MongoDB must be configured as a writable replica set');
    }

    app.listen(PORT, () => {
      console.log(`Microfinance API listening on port ${PORT}`);
      startScheduler();
    });
  } catch (error) {
    console.error(`Unable to connect to MongoDB: ${error.message}`);
    await prisma.$disconnect();
    process.exitCode = 1;
  }
}

start();
