import { useEffect, useState } from 'react';
import DashboardShell from '../../components/DashboardShell';
import { api } from '../../lib/api';

export default function MemberDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('MANUAL');
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [a, n] = await Promise.all([api('/accounts'), api('/notifications')]);
      setAccounts(a);
      setNotifications(n);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  async function openAccount(acc) {
    setSelected(acc);
    try {
      const h = await api(`/payments/${acc.id}/history`);
      setHistory(h);
    } catch (err) { setError(err.message); }
  }

  async function pay(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/payments/${selected.id}`, {
        method: 'POST',
        body: {
          amount: Number(payAmount),
          method: paymentMethod,
          reference: paymentReference.trim() || undefined,
        },
      });
      setPayAmount('');
      setPaymentMethod('MANUAL');
      setPaymentReference('');
      load();
      openAccount(selected);
    } catch (err) { setError(err.message); }
  }

  return (
    <DashboardShell title="My Accounts" requiredRole="MEMBER">
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => openAccount(a)}
            className={`text-left bg-white rounded-xl border p-4 hover:border-brand-600 transition ${selected?.id === a.id ? 'border-brand-600 ring-1 ring-brand-600' : 'border-gray-100'}`}
          >
            <p className="text-xs text-gray-500">{a.type} · {a.accountNumber}</p>
            <p className="text-xl font-semibold text-brand-700">{Number(a.balance).toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{a.frequency} · {a.status}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-medium mb-4">Make a payment — {selected.accountNumber}</h2>
            <form onSubmit={pay} className="space-y-3 text-sm">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1">Amount</label>
                  <input
                    type="number" required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">Payment method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
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
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Reference</label>
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Receipt, mobile number, or transfer ID"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <button className="bg-brand-700 hover:bg-brand-600 text-white rounded-lg px-4 py-2">Pay</button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-medium mb-4">Transaction history</h2>
            <ul className="text-sm space-y-2 max-h-64 overflow-y-auto">
              {history.map((t) => (
                <li key={t.id} className="border-b border-gray-50 pb-2">
                  <div className="flex justify-between gap-2">
                    <span>{t.type}{t.isPartial ? ' (partial)' : ''}{t.isLate ? ' (late)' : ''}</span>
                    <span className="font-medium">{Number(t.amount).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <span>{t.method || 'MANUAL'}</span>
                    {t.reference ? <span className="ml-2">· {t.reference}</span> : null}
                  </div>
                </li>
              ))}
              {history.length === 0 && <p className="text-gray-400">No transactions yet.</p>}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-medium mb-4">Notifications</h2>
        <ul className="text-sm space-y-2">
          {notifications.map((n) => (
            <li key={n.id} className="border-b border-gray-50 pb-2">
              <p className="font-medium">{n.title}</p>
              <p className="text-gray-500">{n.message}</p>
            </li>
          ))}
          {notifications.length === 0 && <p className="text-gray-400">No notifications yet.</p>}
        </ul>
      </div>
    </DashboardShell>
  );
}
