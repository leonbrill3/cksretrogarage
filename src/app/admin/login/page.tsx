'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace('/admin');
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Login failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-2 font-serif text-2xl">CK’s Retro Garage</div>
        <div className="mb-8 text-[11px] uppercase tracking-[0.22em] text-brass">Admin Access</div>
        <label className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-bone-dim">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full border-b border-bone/20 bg-transparent py-3 text-bone focus:border-brass focus:outline-none"
        />
        {error && <p className="mt-3 text-sm text-oxblood-light">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary mt-8 w-full disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
