import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getUser, clearSession } from '../lib/api';

export default function DashboardShell({ title, requiredRole, children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const u = getUser();
    if (!u || (requiredRole && u.role !== requiredRole && u.role !== 'SUPER_ADMIN')) {
      router.replace('/login');
      return;
    }
    setUser(u);
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-brand-700">{title}</h1>
          <p className="text-xs text-gray-500">Signed in as {user.name} ({user.role.replace('_', ' ')})</p>
        </div>
        <button
          onClick={() => { clearSession(); router.push('/login'); }}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Sign out
        </button>
      </header>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
