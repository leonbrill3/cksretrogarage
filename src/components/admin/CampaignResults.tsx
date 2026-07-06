'use client';

import { useMemo, useState } from 'react';
import type { CampaignFind, CampaignRun } from '@/data/campaigns';

const WEEK = 7 * 24 * 3600 * 1000;

function usd(n?: number): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function miles(n?: number): string {
  return typeof n === 'number' ? `${n.toLocaleString('en-US')} mi` : '';
}
function sourceLabel(s: string): string {
  if (!s) return 'Web';
  if (s === 'marketcheck') return 'Marketcheck';
  if (s === 'ebay') return 'eBay';
  if (s === 'web') return 'Web';
  if (s.startsWith('web:')) return s.slice(4);
  return s;
}
function dropAmount(f: CampaignFind): number {
  const hi = Math.max(...(f.priceHistory || []).map((p) => p.price), f.price ?? 0);
  return typeof f.price === 'number' ? hi - f.price : 0;
}
function isNew(f: CampaignFind): boolean {
  return Date.now() - new Date(f.firstSeenAt).getTime() < WEEK;
}

export default function CampaignResults({
  finds,
  campaigns,
  runs,
}: {
  finds: CampaignFind[];
  campaigns: { id: string; name: string }[];
  runs: CampaignRun[];
}) {
  const [view, setView] = useState<'gallery' | 'table'>('gallery');
  const [campaign, setCampaign] = useState('all');
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState<'available' | 'all' | 'new' | 'active' | 'price_drop' | 'gone'>('available');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc' | 'drop'>('newest');

  const campaignName = (id: string) => campaigns.find((c) => c.id === id)?.name || '—';
  const sources = useMemo(() => Array.from(new Set(finds.map((f) => sourceLabel(f.source)))).sort(), [finds]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let r = finds.filter((f) => {
      if (campaign !== 'all' && f.campaignId !== campaign) return false;
      if (source !== 'all' && sourceLabel(f.source) !== source) return false;
      if (status === 'available' && f.status === 'gone') return false;
      if (status === 'new' && !(isNew(f) && f.status !== 'gone')) return false;
      if (status === 'active' && f.status !== 'active') return false;
      if (status === 'price_drop' && f.status !== 'price_drop') return false;
      if (status === 'gone' && f.status !== 'gone') return false;
      if (needle && ![f.title, f.dealer, f.location, f.make, f.model].filter(Boolean).join(' ').toLowerCase().includes(needle)) return false;
      return true;
    });
    r = r.sort((a, b) => {
      if (sort === 'price_asc') return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (sort === 'price_desc') return (b.price ?? -Infinity) - (a.price ?? -Infinity);
      if (sort === 'drop') return dropAmount(b) - dropAmount(a);
      return (b.firstSeenAt < a.firstSeenAt ? -1 : 1); // newest
    });
    return r;
  }, [finds, campaign, source, status, q, sort]);

  const stats = useMemo(() => {
    const active = finds.filter((f) => f.status !== 'gone');
    const newThisWeek = active.filter(isNew).length;
    const withFinds = new Set(finds.map((f) => f.campaignId)).size;
    return { active: active.length, newThisWeek, campaigns: withFinds, total: finds.length };
  }, [finds]);

  function exportCsv() {
    const header = ['Year', 'Make', 'Model', 'Trim', 'Price', 'Mileage', 'Dealer', 'Location', 'Source', 'Status', 'Campaign', 'First seen', 'URL'];
    const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [header.join(',')];
    for (const f of rows) {
      lines.push([f.year ?? '', f.make ?? '', f.model ?? '', f.trim ?? '', f.price ?? '', f.mileage ?? '', f.dealer ?? '', f.location ?? '', sourceLabel(f.source), f.status, campaignName(f.campaignId), f.firstSeenAt?.slice(0, 10) ?? '', f.sourceUrl].map(esc).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ck-sourcing-results.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const input = 'rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

  function StatusPill({ f }: { f: CampaignFind }) {
    if (f.status === 'gone') return <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-neutral-600">Gone</span>;
    if (f.status === 'price_drop') return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">↓ Price drop</span>;
    if (isNew(f)) return <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">🆕 New</span>;
    return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">Active</span>;
  }

  return (
    <div>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Active listings', value: stats.active },
          { label: 'New this week', value: stats.newThisWeek },
          { label: 'Campaigns', value: stats.campaigns },
          { label: 'Total (incl. gone)', value: stats.total },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-neutral-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search make, model, dealer…" className={`${input} w-64 placeholder:text-neutral-400`} />
        <select value={campaign} onChange={(e) => setCampaign(e.target.value)} className={input}>
          <option value="all">All campaigns</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className={input}>
          <option value="all">All sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={input}>
          <option value="available">Available (hide gone)</option>
          <option value="all">All statuses</option>
          <option value="new">🆕 New</option>
          <option value="active">Active</option>
          <option value="price_drop">↓ Price drop</option>
          <option value="gone">Gone</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={input}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="drop">Biggest drop</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-neutral-500">{rows.length} shown</span>
          <div className="flex overflow-hidden rounded-md border border-neutral-300 text-sm">
            <button onClick={() => setView('gallery')} className={`px-3 py-2 ${view === 'gallery' ? 'bg-neutral-900 text-white' : 'text-neutral-700'}`}>Gallery</button>
            <button onClick={() => setView('table')} className={`px-3 py-2 ${view === 'table' ? 'bg-neutral-900 text-white' : 'text-neutral-700'}`}>Table</button>
          </div>
          <button onClick={exportCsv} className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-900">Export CSV</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-12 text-center text-neutral-500">No results match these filters.</div>
      ) : view === 'gallery' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((f) => (
            <div key={f.id} className={`overflow-hidden rounded-lg border ${f.status === 'gone' ? 'border-neutral-200 opacity-60' : f.status === 'price_drop' ? 'border-amber-300' : 'border-neutral-200'}`}>
              {f.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.photo} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-neutral-100 text-sm text-neutral-400">No photo</div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-serif text-lg leading-tight text-neutral-900">{f.title}</div>
                  <StatusPill f={f} />
                </div>
                <div className="mt-1 text-lg font-semibold text-neutral-900">
                  {usd(f.price)} {dropAmount(f) > 0 && <span className="text-sm font-medium text-amber-700">↓ {usd(dropAmount(f))}</span>}
                </div>
                <div className="mt-1 text-sm text-neutral-500">{[miles(f.mileage), f.location, f.dealer].filter(Boolean).join(' · ')}</div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-neutral-600">{sourceLabel(f.source)} · {campaignName(f.campaignId)}</span>
                  <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">View listing ↗</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full border-collapse">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>{['', 'Vehicle', 'Price', 'Mileage', 'Dealer / Location', 'Source', 'Status', 'Campaign', 'Seen', ''].map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    {f.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.photo} alt="" className="h-10 w-14 rounded object-cover" />
                    ) : <div className="h-10 w-14 rounded bg-neutral-100" />}
                  </td>
                  <td className="px-3 py-2 text-sm font-medium text-neutral-900 whitespace-nowrap">{f.title}</td>
                  <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap">{usd(f.price)}{dropAmount(f) > 0 && <span className="text-amber-700"> ↓{usd(dropAmount(f))}</span>}</td>
                  <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap">{miles(f.mileage) || '—'}</td>
                  <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap">{[f.dealer, f.location].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap">{sourceLabel(f.source)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><StatusPill f={f} /></td>
                  <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap">{campaignName(f.campaignId)}</td>
                  <td className="px-3 py-2 text-sm text-neutral-500 whitespace-nowrap">{f.firstSeenAt?.slice(0, 10)}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">Open ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Scan activity */}
      <div className="mt-12">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-900">Scan Activity</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-neutral-400">No scans have run yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full border-collapse">
              <thead className="border-b border-neutral-200 bg-neutral-50">
                <tr>{['When', 'Campaign', 'Slot', 'Sources', 'Found', 'New', 'Drops', 'Removed', 'Note'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 whitespace-nowrap">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {runs.slice(0, 100).map((r) => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap">{new Date(r.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })}</td>
                    <td className="px-3 py-2 text-sm font-medium text-neutral-900 whitespace-nowrap">{campaignName(r.campaignId)}</td>
                    <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap capitalize">{r.slot}</td>
                    <td className="px-3 py-2 text-sm text-neutral-700 whitespace-nowrap">{(r.sources || []).map(sourceLabel).join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-sm text-neutral-700">{r.found}</td>
                    <td className="px-3 py-2 text-sm text-green-700">{r.added || 0}</td>
                    <td className="px-3 py-2 text-sm text-amber-700">{r.priceDrops || 0}</td>
                    <td className="px-3 py-2 text-sm text-neutral-500">{r.removed || 0}</td>
                    <td className="px-3 py-2 text-sm text-red-600 whitespace-nowrap">{r.error ? r.error.slice(0, 60) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
