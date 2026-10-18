# Microfinance Management System — MVP

A minimal, working microfinance platform enforcing:
- 1 Super Admin, 1 Admin, unlimited Members
- Fully independent per-member accounts (no shared balances, no cross-member transfers)
- System-only payments (every payment → an immutable transaction row)
- Per-account simple interest, computed on a schedule
- Personal notifications (in-app + mock SMS, pluggable for a real provider)

## Stack
- **Backend:** Node.js + Express + MongoDB via Prisma, JWT auth, node-cron
- **Frontend:** Next.js (pages router) + Tailwind CSS

## Project layout
```
backend/   Express API, Prisma schema, seed script, cron jobs
frontend/  Next.js app with Super Admin / Admin / Member dashboards
```

## Setup

### 1. Install

From the repository root:
```
npm install
```

### 2. Database
You need MongoDB running as a replica set (MongoDB Atlas works out of the box).
The API uses transactions, so a standalone MongoDB server is not sufficient. For
a local single-node replica set, start `mongod` with `--replSet rs0`, then run
`mongosh --eval "rs.initiate()"` once.
For the Windows MongoDB service, enable `replication: { replSetName: rs0 }` in
its `mongod.cfg`, restart the service from an Administrator PowerShell, then
initialize it once with `mongosh --eval "rs.initiate()"`.
Changing from PostgreSQL does not copy existing records; migrate them separately
before switching an installation that already contains data. Prisma's MongoDB
connector does not support Decimal fields, so monetary values currently use
floating-point storage and retain the app's existing JavaScript number precision.
```
DATABASE_URL="mongodb://127.0.0.1:27017/microfinance?replicaSet=rs0"
```

### 2. Backend
```
copy backend\.env.example backend\.env  # edit connection URL and secrets as needed
npm run db:push
npm run db:seed             # creates 1 Super Admin, 1 Admin, 1 sample member+2 accounts
```

### 3. Frontend
```
copy frontend\.env.local.example frontend\.env.local
npm run dev                 # API http://localhost:4000, app http://localhost:3000
```

Log in at `/login`. Use the "Admin / Super Admin" tab with the seeded email,
or the "Member" tab with the seeded phone number (see console output from
`npm run seed` for exact seeded credentials).

## How the strict rules are enforced

- **Roles & isolation** — every API route runs through `requireAuth` (verifies
  the JWT and loads the current user fresh from the DB) and `requireRole` /
  `scopeToAccount` (backend/src/middleware/rbac.js), which check ownership
  server-side on every request — an Admin can never fetch another Admin's
  members or accounts, and a Member can never fetch another Member's account,
  regardless of what the client sends.
- **Admin cap** — `POST /admins` refuses to create a 5th active admin
  (backend/src/routes/admin.routes.js). Admins are deactivated, never deleted,
  to preserve history.
- **Independent accounts** — the Prisma schema has no relation between
  accounts other than `Account.memberId`; there is no transfer endpoint, so
  moving money between accounts is architecturally impossible, not just
  disallowed by convention.
- **System-only payments, immutable ledger** — the only way to create a
  `Transaction` row is `POST /payments/:accountId`; there is no update or
  delete route for transactions anywhere in the API.
- **Interest engine** — `backend/src/services/interest.service.js` computes
  simple interest per account based on its own frequency and posts one
  `INTEREST_CREDIT` (savings) or `INTEREST_CHARGE` (loan) transaction per
  elapsed period. Wired into `node-cron` in `src/jobs/scheduler.js` (daily at
  01:00). You can also trigger it on demand as Super Admin via
  `POST /notifications/run-jobs` — handy for demoing without waiting for cron.
- **Notifications** — `backend/src/services/notification.service.js` writes
  an in-app row and calls `sms.mock.js`, a stand-in with the exact same
  `send(to, message)` interface a real Africa's Talking/Twilio adapter would
  have, so swapping providers later doesn't touch calling code.
- **Audit log** — `backend/src/utils/audit.js` is called from every
  admin-management, member-registration, account-creation, frequency-change,
  and payment action, and audit rows are never updated or deleted.

## What's intentionally out of scope for this MVP
Per the brief: loan approval workflows, multi-branch support, bulk SMS
campaigns, native mobile apps, and compound/complex amortization schedules.

## Known follow-ups for a production build
- OTP-based member login (currently password-only; the endpoint shape is
  ready for an OTP step to be inserted)
- Real mobile money integration (M-Pesa/Airtel) — the payment `method` enum
  already has a `MOBILE_MONEY` slot waiting for a provider webhook
  reconciliation job
- Pagination on member/account/transaction lists
- Automated tests
