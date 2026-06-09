'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }
  return (
    <button onClick={logout} className="text-sm text-bone-dim hover:text-bone">
      Log out
    </button>
  );
}
