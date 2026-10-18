import { useEffect, useState } from 'react';
import DashboardShell from '../../components/DashboardShell';
import { api } from '../../lib/api';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');

  async function load() {
    try {
      const [s, a] = await Promise.all([api('/reports/global'), api('/admins')]);
      setStats(s);
      setAdmins(a);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  async function createAdmin(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/admins', { method: 'POST', body: form });
      setForm({ fullName: '', email: '', phone: '', password: '' });
      load();
    } catch (err) { setError(err.message); }
  }

  async function toggleAdmin(admin) {
    try {
      await api(`/admins/${admin.id}/${admin.isActive ? 'deactivate' : 'reactivate'}`, { method: 'POST' });
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <DashboardShell title="Super Admin — Global Overview" requiredRole="SUPER_ADMIN">
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Admins" value={stats.adminCount} />
          <StatCard label="Members" value={stats.memberCount} />
          <StatCard label="Active accounts" value={`${stats.activeAccounts}/${stats.totalAccounts}`} />
          <StatCard label="Transactions" value={stats.totalTransactions} />
          <StatCard label="Total savings balance" value={stats.totalSavingsBalance.toFixed(2)} />
          <StatCard label="Total loan balance" value={stats.totalLoanBalance.toFixed(2)} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-medium mb-4">Admins ({admins.length}/4)</h2>
          <ul className="space-y-2 mb-4">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <p className="font-medium">{a.fullName}</p>
                  <p className="text-gray-500">{a.email} · {a.memberCount} members</p>
                </div>
                <button
                  onClick={() => toggleAdmin(a)}
                  className={`text-xs px-2 py-1 rounded ${a.isActive ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                >
                  {a.isActive ? 'Deactivate' : 'Reactivate'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-medium mb-4">Create admin</h2>
          <form onSubmit={createAdmin} className="space-y-3 text-sm">
            <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <button className="bg-brand-700 hover:bg-brand-600 text-white rounded-lg px-4 py-2 text-sm" disabled={admins.length >= 4}>
              {admins.length >= 4 ? 'Max 4 admins reached' : 'Create admin'}
            </button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-brand-700">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600"
      />
    </div>
  );
}
