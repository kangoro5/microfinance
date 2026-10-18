import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { api, setSession } from '../lib/api';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('staff'); // 'staff' | 'member'
  const [memberAction, setMemberAction] = useState('signin');
  const [form, setForm] = useState({ email: '', phone: '', password: '', fullName: '', nationalId: '', address: '', nextOfKin: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const registering = mode === 'member' && memberAction === 'register';
      const path = mode === 'staff'
        ? '/auth/login'
        : registering ? '/auth/member-register' : '/auth/member-login';
      const payload = mode === 'staff'
        ? { email: form.email, password: form.password }
        : registering
          ? { fullName: form.fullName, phone: form.phone, nationalId: form.nationalId, address: form.address, nextOfKin: form.nextOfKin, password: form.password }
          : { phone: form.phone, password: form.password };
      const result = await api(path, { method: 'POST', body: payload });
      if (registering) {
        setSession(result.token, result.user);
        router.push('/member');
        return;
      }
      const { token, user } = result;
      setSession(token, user);
      if (user.role === 'SUPER_ADMIN') router.push('/superadmin');
      else if (user.role === 'ADMIN') router.push('/admin');
      else router.push('/member');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Head>
        <title>Microfinance</title>
      </Head>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-xl font-semibold text-brand-700 mb-1">Microfinance</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>

        <div className="flex mb-6 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            className={`flex-1 py-1.5 rounded-md transition ${mode === 'staff' ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500'}`}
            onClick={() => setMode('staff')}
            type="button"
          >
            Admin / Super Admin
          </button>
          <button
            className={`flex-1 py-1.5 rounded-md transition ${mode === 'member' ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500'}`}
            onClick={() => setMode('member')}
            type="button"
          >
            Member
          </button>
        </div>

        {mode === 'member' && (
          <div className="flex mb-4 border-b border-gray-100 text-sm">
            <button type="button" className={`flex-1 pb-2 ${memberAction === 'signin' ? 'border-b-2 border-brand-700 text-brand-700 font-medium' : 'text-gray-500'}`} onClick={() => { setMemberAction('signin'); setError(''); setSuccess(''); }}>
              Sign in
            </button>
            <button type="button" className={`flex-1 pb-2 ${memberAction === 'register' ? 'border-b-2 border-brand-700 text-brand-700 font-medium' : 'text-gray-500'}`} onClick={() => { setMemberAction('register'); setError(''); setSuccess(''); }}>
              Create account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'member' && memberAction === 'register' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Full name</label>
                <input type="text" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">National ID</label>
                <input type="text" required className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} />
              </div>
            </>
          )}
          {mode === 'staff' ? (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Phone number</label>
              <input
                type="tel"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          )}
          {mode === 'member' && memberAction === 'register' && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Address (optional)</label>
                <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Next of kin (optional)</label>
                <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nextOfKin} onChange={(e) => setForm({ ...form, nextOfKin: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 hover:bg-brand-600 text-white rounded-lg py-2 text-sm font-medium transition disabled:opacity-60"
          >
            {loading ? (memberAction === 'register' ? 'Creating account…' : 'Signing in…') : (memberAction === 'register' ? 'Create account' : 'Sign in')}
          </button>
        </form>
      </div>
    </div>
  );
}
