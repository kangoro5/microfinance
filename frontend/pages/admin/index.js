import { useEffect, useState } from 'react';
import DashboardShell from '../../components/DashboardShell';
import { api } from '../../lib/api';

export default function AdminDashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [memberForm, setMemberForm] = useState({ fullName: '', phone: '', nationalId: '', address: '', nextOfKin: '', password: '' });
  const [accountForm, setAccountForm] = useState({ memberId: '', type: 'SAVINGS', openingBalance: 0, interestRate: 5, frequency: 'MONTHLY' });
  const [paymentForm, setPaymentForm] = useState({ accountId: '', amount: '', method: 'MANUAL', reference: '' });

  async function load() {
    try {
      const [p, m] = await Promise.all([api('/reports/my-portfolio'), api('/members')]);
      setPortfolio(p);
      setMembers(m);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  const accounts = members.flatMap((member) =>
    member.accounts.map((account) => ({ ...account, memberName: member.fullName }))
  );
  const visibleAccounts = activeTab === 'savings'
    ? accounts.filter((account) => account.type === 'SAVINGS')
    : activeTab === 'loans'
      ? accounts.filter((account) => account.type === 'LOAN')
      : accounts;
  const portfolioTitles = {
    members: 'My members',
    accounts: 'My accounts',
    savings: 'Savings accounts',
    loans: 'Loan accounts',
  };
  const portfolioTabIds = ['members', 'accounts', 'savings', 'loans'];

  function handlePortfolioTabKeyDown(event, index) {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % portfolioTabIds.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + portfolioTabIds.length) % portfolioTabIds.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = portfolioTabIds.length - 1;
    else return;

    event.preventDefault();
    const nextTab = portfolioTabIds[nextIndex];
    setActiveTab(nextTab);
    document.getElementById(`portfolio-tab-${nextTab}`)?.focus();
  }

  async function registerMember(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api('/members', { method: 'POST', body: memberForm });
      setMemberForm({ fullName: '', phone: '', nationalId: '', address: '', nextOfKin: '', password: '' });
      await load();
      setSuccess('Member created. You can now open an account for them.');
    } catch (err) { setError(err.message); }
  }

  async function createAccount(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api('/accounts', {
        method: 'POST',
        body: {
          ...accountForm,
          openingBalance: Number(accountForm.openingBalance),
          interestRate: Number(accountForm.interestRate),
        },
      });
      setAccountForm({ ...accountForm, memberId: '' });
      await load();
      setSuccess('Account created successfully.');
    } catch (err) { setError(err.message); }
  }

  async function recordPayment(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api(`/payments/${paymentForm.accountId}`, {
        method: 'POST',
        body: {
          amount: Number(paymentForm.amount),
          method: paymentForm.method,
          reference: paymentForm.reference.trim() || undefined,
        },
      });
      setPaymentForm({ accountId: '', amount: '', method: 'MANUAL', reference: '' });
      load();
      setSuccess('Payment recorded successfully.');
    } catch (err) { setError(err.message); }
  }

  return (
    <DashboardShell title="Admin Dashboard" requiredRole="ADMIN">
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {success && <p role="status" className="text-sm text-green-700 mb-4">{success}</p>}

      {portfolio && (
        <div role="tablist" aria-label="Portfolio views" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat id="members" label="My members" value={portfolio.memberCount} selected={activeTab === 'members'} onClick={() => setActiveTab('members')} onKeyDown={(event) => handlePortfolioTabKeyDown(event, 0)} />
          <Stat id="accounts" label="My accounts" value={portfolio.accountCount} selected={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} onKeyDown={(event) => handlePortfolioTabKeyDown(event, 1)} />
          <Stat id="savings" label="Savings balance" value={portfolio.totalSavingsBalance.toFixed(2)} selected={activeTab === 'savings'} onClick={() => setActiveTab('savings')} onKeyDown={(event) => handlePortfolioTabKeyDown(event, 2)} />
          <Stat id="loans" label="Loan balance" value={portfolio.totalLoanBalance.toFixed(2)} selected={activeTab === 'loans'} onClick={() => setActiveTab('loans')} onKeyDown={(event) => handlePortfolioTabKeyDown(event, 3)} />
        </div>
      )}

      <Card id="portfolio-panel" role="tabpanel" tabIndex={0} labelledBy={`portfolio-tab-${activeTab}`} title={portfolioTitles[activeTab]}>
        {activeTab === 'members' ? (
          <div className="space-y-4 text-sm">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 border-b border-gray-50 pb-3">
                <div>
                  <p className="font-medium">{member.fullName} · {member.phone}</p>
                  <p className="mt-1 text-xs text-gray-500">{member.accounts.length} accounts</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountForm((current) => ({ ...current, memberId: member.id }));
                    document.getElementById('create-account-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="shrink-0 rounded border border-brand-700 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  Add account
                </button>
              </div>
            ))}
            {members.length === 0 && <p className="text-gray-500">No members yet.</p>}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            {visibleAccounts.map((account) => (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 pb-3">
                <div>
                  <p className="font-medium">{account.memberName}</p>
                  <p className="text-xs text-gray-500">{account.accountNumber} · {account.type} · {account.status}</p>
                </div>
                <p className="font-semibold text-brand-700">{Number(account.balance).toFixed(2)}</p>
              </div>
            ))}
            {visibleAccounts.length === 0 && <p className="text-gray-500">No {activeTab === 'savings' ? 'savings' : activeTab === 'loans' ? 'loan' : ''} accounts yet.</p>}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        <Card title="Register a member">
          <form onSubmit={registerMember} className="space-y-3 text-sm">
            <Field label="Full name" value={memberForm.fullName} onChange={(v) => setMemberForm({ ...memberForm, fullName: v })} />
            <Field label="Phone" value={memberForm.phone} onChange={(v) => setMemberForm({ ...memberForm, phone: v })} />
            <Field label="National ID" value={memberForm.nationalId} onChange={(v) => setMemberForm({ ...memberForm, nationalId: v })} />
            <Field label="Address" value={memberForm.address} onChange={(v) => setMemberForm({ ...memberForm, address: v })} required={false} />
            <Field label="Next of kin" value={memberForm.nextOfKin} onChange={(v) => setMemberForm({ ...memberForm, nextOfKin: v })} required={false} />
            <Field label="Password" type="password" value={memberForm.password} onChange={(v) => setMemberForm({ ...memberForm, password: v })} />
            <button className="bg-brand-700 hover:bg-brand-600 text-white rounded-lg px-4 py-2">Register member</button>
          </form>
        </Card>

        <Card id="create-account-card" title="Create independent account">
          <form onSubmit={createAccount} className="space-y-3 text-sm">
            <div>
              <label className="block text-gray-600 mb-1">Member</label>
              <select
                required
                value={accountForm.memberId}
                onChange={(e) => setAccountForm({ ...accountForm, memberId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="">Select member…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.fullName}</option>)}
              </select>
              {members.length === 0 && <p className="mt-1 text-xs text-gray-500">Register a member first to open an account.</p>}
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Account type</label>
              <select
                value={accountForm.type}
                onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="SAVINGS">Savings</option>
                <option value="LOAN">Loan</option>
              </select>
            </div>
            <Field label="Opening balance" type="number" min="0" step="any" value={accountForm.openingBalance} onChange={(v) => setAccountForm({ ...accountForm, openingBalance: v })} />
            <Field label="Interest rate (% p.a.)" type="number" min="0" step="any" value={accountForm.interestRate} onChange={(v) => setAccountForm({ ...accountForm, interestRate: v })} />
            <div>
              <label className="block text-gray-600 mb-1">Payment frequency</label>
              <select
                value={accountForm.frequency}
                onChange={(e) => setAccountForm({ ...accountForm, frequency: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <button disabled={members.length === 0} className="bg-brand-700 hover:bg-brand-600 text-white rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed">Create account</button>
          </form>
        </Card>
      </div>

      <Card title="Record a system payment">
        <form onSubmit={recordPayment} className="space-y-3 text-sm">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="min-w-[220px]">
              <label className="block text-gray-600 mb-1">Account ID</label>
              <input
                required
                placeholder="Paste account ID from member list below"
                value={paymentForm.accountId}
                onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Amount</label>
              <input
                type="number" required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 mb-1">Payment method</label>
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="MANUAL">Manual</option>
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="MPESA">M-Pesa</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CARD">Card</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Reference</label>
              <input
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                placeholder="Receipt, mobile number, or transfer ID"
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <button className="bg-brand-700 hover:bg-brand-600 text-white rounded-lg px-4 py-2">Record payment</button>
        </form>
      </Card>

    </DashboardShell>
  );
}

function Stat({ id, label, value, selected, onClick, onKeyDown }) {
  return (
    <button
      id={`portfolio-tab-${id}`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls="portfolio-panel"
      tabIndex={selected ? 0 : -1}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${selected ? 'border-brand-700 bg-white ring-1 ring-brand-700' : 'border-gray-100 bg-white hover:border-brand-300'}`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-brand-700">{value}</p>
    </button>
  );
}

function Card({ title, children, id, role, tabIndex, labelledBy }) {
  return (
    <div id={id} role={role} tabIndex={tabIndex} aria-labelledby={labelledBy} className="bg-white rounded-xl border border-gray-100 p-5 mb-8">
      <h2 className="font-medium mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = true, min, step }) {
  return (
    <div>
      <label className="block text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        required={required}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600"
      />
    </div>
  );
}
